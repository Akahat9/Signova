import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn


DEFAULT_SEQUENCE_LENGTH = 40
DEFAULT_FEATURE_SIZE = 126
MULTIMODAL_FEATURE_SIZE = 165


def load_json(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def normalize_sequence(sequence, sequence_length=DEFAULT_SEQUENCE_LENGTH, feature_size=DEFAULT_FEATURE_SIZE):
    frames = np.asarray(sequence, dtype=np.float32)
    if frames.ndim == 1:
        frames = frames.reshape(1, -1)
    if frames.ndim != 2:
        raise ValueError("Expected a 2D sequence array.")

    if frames.shape[1] < feature_size:
        padded = np.zeros((frames.shape[0], feature_size), dtype=np.float32)
        padded[:, : frames.shape[1]] = frames
        frames = padded
    elif frames.shape[1] > feature_size:
        frames = frames[:, :feature_size]

    if len(frames) == 0:
        frames = np.zeros((1, feature_size), dtype=np.float32)

    if len(frames) == sequence_length:
        return frames.astype(np.float32)

    if len(frames) > sequence_length:
        indices = np.linspace(0, len(frames) - 1, sequence_length).round().astype(int)
        return frames[indices].astype(np.float32)

    output = np.zeros((sequence_length, feature_size), dtype=np.float32)
    output[: len(frames)] = frames
    output[len(frames) :] = frames[-1]
    return output


class SignovaSequenceModel(nn.Module):
    def __init__(
        self,
        input_size=DEFAULT_FEATURE_SIZE,
        hidden_size=192,
        num_layers=2,
        num_classes=10,
        dropout=0.25,
        rnn_type="gru",
    ):
        super().__init__()
        recurrent = nn.GRU if rnn_type.lower() == "gru" else nn.LSTM
        self.rnn_type = rnn_type.lower()
        self.input_norm = nn.LayerNorm(input_size)
        self.rnn = recurrent(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=True,
        )
        self.head = nn.Sequential(
            nn.LayerNorm(hidden_size * 2),
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, num_classes),
        )

    def forward(self, inputs):
        inputs = self.input_norm(inputs)
        outputs, _ = self.rnn(inputs)
        pooled = outputs.mean(dim=1)
        return self.head(pooled)


class PositionalEncoding(nn.Module):
    def __init__(self, model_dim, max_length=256, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)

        positions = torch.arange(max_length, dtype=torch.float32).unsqueeze(1)
        div_terms = torch.exp(torch.arange(0, model_dim, 2, dtype=torch.float32) * (-np.log(10000.0) / model_dim))
        encoding = torch.zeros(max_length, model_dim, dtype=torch.float32)
        encoding[:, 0::2] = torch.sin(positions * div_terms)
        encoding[:, 1::2] = torch.cos(positions * div_terms[: encoding[:, 1::2].shape[1]])
        self.register_buffer("encoding", encoding.unsqueeze(0))

    def forward(self, inputs):
        inputs = inputs + self.encoding[:, : inputs.size(1)]
        return self.dropout(inputs)


class SignovaTransformerModel(nn.Module):
    def __init__(
        self,
        input_size=DEFAULT_FEATURE_SIZE,
        model_dim=128,
        num_heads=4,
        num_layers=3,
        num_classes=10,
        dropout=0.2,
        max_length=DEFAULT_SEQUENCE_LENGTH,
    ):
        super().__init__()
        self.input_norm = nn.LayerNorm(input_size)
        self.input_projection = nn.Linear(input_size, model_dim)
        self.position = PositionalEncoding(model_dim, max_length=max_length, dropout=dropout)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=model_dim,
            nhead=num_heads,
            dim_feedforward=model_dim * 4,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.head = nn.Sequential(
            nn.LayerNorm(model_dim),
            nn.Linear(model_dim, model_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(model_dim, num_classes),
        )

    def forward(self, inputs):
        inputs = self.input_norm(inputs)
        encoded = self.input_projection(inputs)
        encoded = self.position(encoded)
        encoded = self.encoder(encoded)
        pooled = encoded.mean(dim=1)
        return self.head(pooled)


class SignovaTemporalCNNTransformerModel(nn.Module):
    def __init__(
        self,
        input_size=DEFAULT_FEATURE_SIZE,
        model_dim=128,
        num_heads=4,
        num_layers=3,
        num_classes=10,
        dropout=0.2,
        max_length=DEFAULT_SEQUENCE_LENGTH,
    ):
        super().__init__()
        self.input_norm = nn.LayerNorm(input_size)
        self.input_projection = nn.Linear(input_size, model_dim)
        self.temporal = nn.Sequential(
            nn.Conv1d(model_dim, model_dim, kernel_size=3, padding=1),
            nn.BatchNorm1d(model_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Conv1d(model_dim, model_dim, kernel_size=5, padding=2),
            nn.BatchNorm1d(model_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        self.position = PositionalEncoding(model_dim, max_length=max_length, dropout=dropout)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=model_dim,
            nhead=num_heads,
            dim_feedforward=model_dim * 4,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.head = nn.Sequential(
            nn.LayerNorm(model_dim),
            nn.Linear(model_dim, model_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(model_dim, num_classes),
        )

    def forward(self, inputs):
        inputs = self.input_norm(inputs)
        projected = self.input_projection(inputs)
        local_motion = self.temporal(projected.transpose(1, 2)).transpose(1, 2)
        encoded = self.position(projected + local_motion)
        encoded = self.encoder(encoded)
        return self.head(encoded.mean(dim=1))


def main():
    sample = torch.zeros(2, DEFAULT_SEQUENCE_LENGTH, DEFAULT_FEATURE_SIZE)
    gru = SignovaSequenceModel(num_classes=5)
    transformer = SignovaTransformerModel(num_classes=5)
    hybrid = SignovaTemporalCNNTransformerModel(num_classes=5)
    print("Signova sequence models are ready.")
    print(f"Input shape: {tuple(sample.shape)}")
    print(f"GRU output shape: {tuple(gru(sample).shape)}")
    print(f"Transformer output shape: {tuple(transformer(sample).shape)}")
    print(f"Temporal CNN Transformer output shape: {tuple(hybrid(sample).shape)}")


if __name__ == "__main__":
    main()
