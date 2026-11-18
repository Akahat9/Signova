"""Multimodal sign-language recognition and translation Transformer.

This module is deliberately independent from the legacy isolated-sign models.
It consumes time-major MediaPipe or video features, predicts an intermediate
language-specific gloss sequence with CTC, and translates that representation
into written-language tokens with an encoder-decoder Transformer.

Create one model/checkpoint/class-map per sign language.  ASL and ISL labels
must never be mixed into a shared classifier merely because their tensors have
the same shape.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import torch
from torch import Tensor, nn
from torch.nn import functional as F
from torch.optim import AdamW
from torch.optim.lr_scheduler import LambdaLR


class RMSNorm(nn.Module):
    """Root-mean-square normalization with no additive bias."""

    def __init__(self, dimension: int, eps: float = 1e-6) -> None:
        super().__init__()
        self.eps = eps
        self.scale = nn.Parameter(torch.ones(dimension))

    def forward(self, values: Tensor) -> Tensor:
        variance = values.square().mean(dim=-1, keepdim=True)
        return values * torch.rsqrt(variance + self.eps) * self.scale


class SwiGLU(nn.Module):
    """Bias-free SwiGLU feed-forward block."""

    def __init__(self, dimension: int, hidden_dimension: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.gate = nn.Linear(dimension, hidden_dimension, bias=False)
        self.value = nn.Linear(dimension, hidden_dimension, bias=False)
        self.output = nn.Linear(hidden_dimension, dimension, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, values: Tensor) -> Tensor:
        values = F.silu(self.gate(values)) * self.value(values)
        return self.output(self.dropout(values))


class RotaryEmbedding(nn.Module):
    """RoPE cache for self-attention queries and keys."""

    def __init__(self, head_dimension: int, base: float = 10_000.0) -> None:
        super().__init__()
        if head_dimension % 2:
            raise ValueError("RoPE requires an even attention-head dimension.")
        inverse_frequency = 1.0 / (base ** (torch.arange(0, head_dimension, 2).float() / head_dimension))
        self.register_buffer("inverse_frequency", inverse_frequency, persistent=False)

    def forward(self, values: Tensor) -> Tensor:
        # values: [batch, heads, time, head_dimension]
        positions = torch.arange(values.size(-2), device=values.device, dtype=self.inverse_frequency.dtype)
        angles = torch.outer(positions, self.inverse_frequency).to(values.dtype)
        cosine = angles.cos()[None, None, :, :]
        sine = angles.sin()[None, None, :, :]
        even, odd = values[..., 0::2], values[..., 1::2]
        rotated = torch.stack((even * cosine - odd * sine, even * sine + odd * cosine), dim=-1)
        return rotated.flatten(-2)


class MultiHeadAttention(nn.Module):
    """Bias-free attention. RoPE is used only for temporal self-attention."""

    def __init__(self, dimension: int, heads: int, dropout: float = 0.1, use_rope: bool = True) -> None:
        super().__init__()
        if dimension % heads:
            raise ValueError("model_dimension must be divisible by attention_heads.")
        self.heads = heads
        self.head_dimension = dimension // heads
        self.query = nn.Linear(dimension, dimension, bias=False)
        self.key = nn.Linear(dimension, dimension, bias=False)
        self.value = nn.Linear(dimension, dimension, bias=False)
        self.output = nn.Linear(dimension, dimension, bias=False)
        self.dropout = dropout
        self.rope = RotaryEmbedding(self.head_dimension) if use_rope else None

    def _split_heads(self, values: Tensor) -> Tensor:
        batch, steps, _ = values.shape
        return values.view(batch, steps, self.heads, self.head_dimension).transpose(1, 2)

    def forward(
        self,
        query_values: Tensor,
        key_value_values: Tensor | None = None,
        key_padding_mask: Tensor | None = None,
        causal: bool = False,
    ) -> Tensor:
        source = query_values if key_value_values is None else key_value_values
        query = self._split_heads(self.query(query_values))
        key = self._split_heads(self.key(source))
        value = self._split_heads(self.value(source))
        if self.rope is not None and key_value_values is None:
            query, key = self.rope(query), self.rope(key)

        attention_mask = None
        if key_padding_mask is not None:
            # scaled_dot_product_attention accepts True where attention is allowed.
            attention_mask = key_padding_mask[:, None, None, :].to(dtype=torch.bool)
        if causal:
            causal_mask = torch.ones(
                query.size(-2), key.size(-2), device=query.device, dtype=torch.bool
            ).tril()
            attention_mask = causal_mask if attention_mask is None else attention_mask & causal_mask
        attended = F.scaled_dot_product_attention(
            query,
            key,
            value,
            attn_mask=attention_mask,
            dropout_p=self.dropout if self.training else 0.0,
            is_causal=False,
        )
        attended = attended.transpose(1, 2).contiguous().view(query_values.size(0), query_values.size(1), -1)
        return self.output(attended)


class EncoderBlock(nn.Module):
    def __init__(self, dimension: int, heads: int, feed_forward_dimension: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.attention_norm = RMSNorm(dimension)
        self.attention = MultiHeadAttention(dimension, heads, dropout, use_rope=True)
        self.feed_forward_norm = RMSNorm(dimension)
        self.feed_forward = SwiGLU(dimension, feed_forward_dimension, dropout)
        self.dropout = nn.Dropout(dropout)

    def forward(self, values: Tensor, valid_mask: Tensor | None) -> Tensor:
        values = values + self.dropout(self.attention(self.attention_norm(values), key_padding_mask=valid_mask))
        return values + self.dropout(self.feed_forward(self.feed_forward_norm(values)))


class DecoderBlock(nn.Module):
    def __init__(self, dimension: int, heads: int, feed_forward_dimension: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.self_norm = RMSNorm(dimension)
        self.self_attention = MultiHeadAttention(dimension, heads, dropout, use_rope=True)
        self.cross_norm = RMSNorm(dimension)
        self.cross_attention = MultiHeadAttention(dimension, heads, dropout, use_rope=False)
        self.feed_forward_norm = RMSNorm(dimension)
        self.feed_forward = SwiGLU(dimension, feed_forward_dimension, dropout)
        self.dropout = nn.Dropout(dropout)

    def forward(self, values: Tensor, memory: Tensor, memory_valid_mask: Tensor | None, target_valid_mask: Tensor | None) -> Tensor:
        values = values + self.dropout(self.self_attention(self.self_norm(values), key_padding_mask=target_valid_mask, causal=True))
        values = values + self.dropout(self.cross_attention(self.cross_norm(values), memory, memory_valid_mask))
        return values + self.dropout(self.feed_forward(self.feed_forward_norm(values)))


class FeatureProjector(nn.Module):
    """Projects MediaPipe landmarks or video embeddings to model space."""

    def __init__(self, feature_dimension: int, model_dimension: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.normalization = RMSNorm(feature_dimension)
        self.projection = nn.Linear(feature_dimension, model_dimension, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, features: Tensor) -> Tensor:
        return self.dropout(self.projection(self.normalization(features)))


class SignTransformerEncoder(nn.Module):
    def __init__(self, dimension: int, heads: int, layers: int, feed_forward_dimension: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.blocks = nn.ModuleList([EncoderBlock(dimension, heads, feed_forward_dimension, dropout) for _ in range(layers)])
        self.normalization = RMSNorm(dimension)

    def forward(self, values: Tensor, valid_mask: Tensor | None = None) -> Tensor:
        for block in self.blocks:
            values = block(values, valid_mask)
        return self.normalization(values)


class SignTransformerDecoder(nn.Module):
    def __init__(self, vocabulary_size: int, dimension: int, heads: int, layers: int, feed_forward_dimension: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.embedding = nn.Embedding(vocabulary_size, dimension)
        self.dropout = nn.Dropout(dropout)
        self.blocks = nn.ModuleList([DecoderBlock(dimension, heads, feed_forward_dimension, dropout) for _ in range(layers)])
        self.normalization = RMSNorm(dimension)

    def forward(self, target_tokens: Tensor, memory: Tensor, memory_valid_mask: Tensor | None, target_valid_mask: Tensor | None = None) -> Tensor:
        values = self.dropout(self.embedding(target_tokens) * math.sqrt(self.embedding.embedding_dim))
        for block in self.blocks:
            values = block(values, memory, memory_valid_mask, target_valid_mask)
        return self.normalization(values)


class RoPESwiGLUSequenceClassifier(nn.Module):
    """Encoder-only baseline for an existing isolated-sign dataset.

    This uses the same FeatureProjector and encoder as the translation model,
    without pretending that isolated labels are sentence translations.
    """

    def __init__(
        self,
        feature_dimension: int,
        class_count: int,
        model_dimension: int = 256,
        attention_heads: int = 8,
        encoder_layers: int = 4,
        feed_forward_dimension: int = 768,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.feature_projector = FeatureProjector(feature_dimension, model_dimension, dropout)
        self.encoder = SignTransformerEncoder(
            model_dimension, attention_heads, encoder_layers, feed_forward_dimension, dropout
        )
        self.pool_norm = RMSNorm(model_dimension)
        self.pool_score = nn.Linear(model_dimension, 1, bias=False)
        self.classifier = nn.Linear(model_dimension, class_count, bias=False)

    def forward(self, features: Tensor, feature_valid_mask: Tensor | None = None) -> Tensor:
        encoded = self.encoder(self.feature_projector(features), feature_valid_mask)
        scores = self.pool_score(self.pool_norm(encoded)).squeeze(-1)
        if feature_valid_mask is not None:
            scores = scores.masked_fill(~feature_valid_mask.bool(), torch.finfo(scores.dtype).min)
        weights = scores.softmax(dim=1).unsqueeze(-1)
        return self.classifier((encoded * weights).sum(dim=1))


class GlossToGrammarAlignmentHead(nn.Module):
    """Independent heads for intermediate gloss recognition and written output."""

    def __init__(self, dimension: int, gloss_vocabulary_size: int, text_vocabulary_size: int) -> None:
        super().__init__()
        self.gloss_classifier = nn.Linear(dimension, gloss_vocabulary_size, bias=False)
        self.text_classifier = nn.Linear(dimension, text_vocabulary_size, bias=False)

    def gloss_logits(self, encoded_features: Tensor) -> Tensor:
        return self.gloss_classifier(encoded_features)

    def text_logits(self, decoded_features: Tensor) -> Tensor:
        return self.text_classifier(decoded_features)


@dataclass(frozen=True)
class MultimodalSLTConfig:
    feature_dimension: int
    gloss_vocabulary_size: int
    text_vocabulary_size: int
    model_dimension: int = 256
    attention_heads: int = 8
    encoder_layers: int = 4
    decoder_layers: int = 4
    feed_forward_dimension: int = 768
    dropout: float = 0.1
    blank_gloss_id: int = 0
    pad_text_id: int = 0


class MultimodalSignLanguageTransformer(nn.Module):
    """One language-specific model: instantiate separately for ISL and ASL."""

    def __init__(self, config: MultimodalSLTConfig) -> None:
        super().__init__()
        self.config = config
        self.feature_projector = FeatureProjector(config.feature_dimension, config.model_dimension, config.dropout)
        self.encoder = SignTransformerEncoder(config.model_dimension, config.attention_heads, config.encoder_layers, config.feed_forward_dimension, config.dropout)
        self.decoder = SignTransformerDecoder(config.text_vocabulary_size, config.model_dimension, config.attention_heads, config.decoder_layers, config.feed_forward_dimension, config.dropout)
        self.alignment_head = GlossToGrammarAlignmentHead(config.model_dimension, config.gloss_vocabulary_size, config.text_vocabulary_size)

    def encode(self, features: Tensor, feature_valid_mask: Tensor | None = None) -> tuple[Tensor, Tensor]:
        memory = self.encoder(self.feature_projector(features), feature_valid_mask)
        return memory, self.alignment_head.gloss_logits(memory)

    def forward(self, features: Tensor, target_tokens: Tensor, feature_valid_mask: Tensor | None = None, target_valid_mask: Tensor | None = None) -> dict[str, Tensor]:
        memory, gloss_logits = self.encode(features, feature_valid_mask)
        decoded = self.decoder(target_tokens, memory, feature_valid_mask, target_valid_mask)
        return {"gloss_logits": gloss_logits, "text_logits": self.alignment_head.text_logits(decoded), "encoder_memory": memory}

    def losses(self, outputs: dict[str, Tensor], gloss_targets: Tensor, gloss_target_lengths: Tensor, feature_lengths: Tensor, text_targets: Tensor, gloss_weight: float = 1.0, text_weight: float = 1.0) -> dict[str, Tensor]:
        ctc = F.ctc_loss(
            outputs["gloss_logits"].log_softmax(dim=-1).transpose(0, 1), gloss_targets,
            feature_lengths, gloss_target_lengths, blank=self.config.blank_gloss_id, zero_infinity=True,
        )
        text = F.cross_entropy(outputs["text_logits"].reshape(-1, self.config.text_vocabulary_size), text_targets.reshape(-1), ignore_index=self.config.pad_text_id)
        return {"loss": gloss_weight * ctc + text_weight * text, "ctc_loss": ctc, "text_loss": text}


def build_optimizer_and_scheduler(model: nn.Module, total_steps: int, warmup_steps: int, learning_rate: float = 3e-4) -> tuple[AdamW, LambdaLR]:
    """AdamW plus linear warmup followed by cosine annealing."""
    if total_steps <= 0 or warmup_steps < 0 or warmup_steps >= total_steps:
        raise ValueError("Require total_steps > warmup_steps >= 0.")
    optimizer = AdamW(model.parameters(), lr=learning_rate, betas=(0.9, 0.95), weight_decay=0.05)

    def schedule(step: int) -> float:
        if step < warmup_steps:
            return float(step + 1) / max(1, warmup_steps)
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1.0 + math.cos(math.pi * min(1.0, progress)))

    return optimizer, LambdaLR(optimizer, schedule)
