import React, { useState, useEffect } from 'react';

export default function SignovaCheckoutModal({
  isOpen,
  onClose,
  plan,
  user = {},
  onPaymentSuccess,
}) {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [upiMethod, setUpiMethod] = useState('qr'); // 'qr' | 'vpa'
  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState(user.name || 'Akshat Sharma');

  // Net banking fields
  const [selectedBank, setSelectedBank] = useState('hdfc');

  // Payment progress states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [txnDetails, setTxnDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync default billing cycle if plan specifies annual
  useEffect(() => {
    if (plan?.defaultInterval === 'year') {
      setBillingCycle('annual');
    } else {
      setBillingCycle('monthly');
    }
    setErrorMessage('');
    setIsProcessing(false);
    setIsSuccess(false);
    setTxnDetails(null);
  }, [plan, isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen || !plan) return null;

  // Calculate pricing based on plan and cycle
  let currentPrice = plan.price || 149;
  let intervalLabel = '/month';

  if (plan.id === 'institution') {
    if (billingCycle === 'annual') {
      currentPrice = 2999;
      intervalLabel = '/year';
    } else {
      currentPrice = 349;
      intervalLabel = '/month';
    }
  } else if (plan.id === 'student') {
    currentPrice = 149;
    intervalLabel = '/month';
  } else if (plan.id === 'pro') {
    currentPrice = 249;
    intervalLabel = '/month';
  }

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  // Format CVV (3-4 digits)
  const handleCvvChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardCvv(raw);
  };

  const handleVerifyUpi = () => {
    if (!upiId || !upiId.includes('@')) {
      setErrorMessage('Please enter a valid UPI ID (e.g., username@oksbi or mobile@paytm)');
      return;
    }
    setErrorMessage('');
    setUpiVerified(true);
  };

  // Execute payment simulation
  const handlePayNow = () => {
    setErrorMessage('');

    // Quick validations
    if (paymentMethod === 'card') {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 15) {
        setErrorMessage('Please enter a valid 16-digit card number.');
        return;
      }
      if (cardExpiry.length < 5) {
        setErrorMessage('Please enter card expiry in MM/YY format.');
        return;
      }
      if (cardCvv.length < 3) {
        setErrorMessage('Please enter a valid 3-digit CVV.');
        return;
      }
    } else if (paymentMethod === 'upi' && upiMethod === 'vpa') {
      if (!upiId || !upiId.includes('@')) {
        setErrorMessage('Please enter and verify your UPI ID.');
        return;
      }
    }

    setIsProcessing(true);
    setProcessingStep('Connecting to Secure Payment Gateway (256-bit SSL)...');

    setTimeout(() => {
      setProcessingStep('Authorizing payment with bank / UPI network...');
    }, 700);

    setTimeout(() => {
      setProcessingStep('Issuing Signova Pro subscription credentials...');
    }, 1400);

    setTimeout(() => {
      const txnId = `SIG-TXN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
      const completedTxn = {
        txnId,
        planName: plan.name,
        amount: currentPrice,
        currency: 'INR',
        interval: intervalLabel,
        billingCycle,
        paymentMethod: paymentMethod.toUpperCase(),
        date: new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setTxnDetails(completedTxn);
      setIsProcessing(false);
      setIsSuccess(true);

      // Call external handler to update local state / settings
      if (onPaymentSuccess) {
        onPaymentSuccess({
          ...plan,
          price: currentPrice,
          billingCycle,
          txnId,
        });
      }
    }, 2000);
  };

  // Download receipt as text file
  const handleDownloadInvoice = () => {
    if (!txnDetails) return;
    const invoiceContent = `========================================================
            SIGNOVA TECHNOLOGIES PRIVATE LIMITED
               OFFICIAL PAYMENT RECEIPT & TAX INVOICE
========================================================
Transaction Reference : ${txnDetails.txnId}
Date & Time           : ${txnDetails.date}
Customer Name         : ${user.name || 'Signova User'}
Customer Username     : ${user.username || '@signova.user'}
--------------------------------------------------------
SUBSCRIPTION DETAILS
Plan Name             : ${txnDetails.planName}
Billing Interval      : ${txnDetails.interval} (${txnDetails.billingCycle})
Base Subscription Fee : INR ₹${txnDetails.amount}.00
GST (18% Included)    : INR ₹${(txnDetails.amount * 0.18 / 1.18).toFixed(2)}
Discount Applied      : INR ₹0.00
--------------------------------------------------------
TOTAL PAID            : INR ₹${txnDetails.amount}.00
Payment Method        : ${txnDetails.paymentMethod}
Payment Status        : SUCCESS / SETTLED
Payment Gateway       : Signova Secure Razorpay/UPI Simulator
--------------------------------------------------------
Thank you for supporting inclusive AI sign language communication!
For billing support: support@signova.ai | https://signova.ai
========================================================`;

    const blob = new Blob([invoiceContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Signova_Invoice_${txnDetails.txnId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="signovaCheckoutOverlay" role="dialog" aria-modal="true">
      <div className="signovaCheckoutCard">
        {/* Header */}
        <div className="signovaCheckoutHeader">
          <div className="checkoutTitleGroup">
            <div className="checkoutShieldIcon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            <div>
              <h3>Signova Secure Checkout</h3>
              <p className="checkoutSubTitle">100% Secure 256-Bit Encrypted Payment in INR (₹)</p>
            </div>
          </div>
          {!isProcessing && (
            <button
              type="button"
              className="checkoutCloseBtn"
              onClick={onClose}
              aria-label="Close checkout"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content body */}
        <div className="signovaCheckoutBody">
          {isProcessing ? (
            /* Processing State */
            <div className="checkoutProcessingBox">
              <div className="checkoutSpinnerRing">
                <div />
              </div>
              <h4>Processing Your Payment</h4>
              <p className="checkoutStepText">{processingStep}</p>
              <div className="checkoutSecurityNote">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Please do not refresh or close this window</span>
              </div>
            </div>
          ) : isSuccess ? (
            /* Success State */
            <div className="checkoutSuccessBox">
              <div className="checkoutSuccessTick">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#10b981" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="successPillBadge">PAYMENT SUCCESSFUL</span>
              <h3>Welcome to {txnDetails?.planName}!</h3>
              <p className="successSubtitle">
                Your subscription has been activated immediately on your Signova account.
              </p>

              <div className="txnReceiptCard">
                <div className="txnReceiptRow">
                  <span>Transaction ID:</span>
                  <strong>{txnDetails?.txnId}</strong>
                </div>
                <div className="txnReceiptRow">
                  <span>Amount Paid:</span>
                  <strong className="receiptPrice">₹{txnDetails?.amount}</strong>
                </div>
                <div className="txnReceiptRow">
                  <span>Billing Cycle:</span>
                  <span>{txnDetails?.interval}</span>
                </div>
                <div className="txnReceiptRow">
                  <span>Payment Mode:</span>
                  <span>{txnDetails?.paymentMethod}</span>
                </div>
                <div className="txnReceiptRow">
                  <span>Date & Time:</span>
                  <span>{txnDetails?.date}</span>
                </div>
              </div>

              <div className="checkoutSuccessActions">
                <button
                  type="button"
                  className="downloadReceiptBtn"
                  onClick={handleDownloadInvoice}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>Download Tax Invoice</span>
                </button>
                <button
                  type="button"
                  className="finishCheckoutBtn"
                  onClick={onClose}
                >
                  Done & Continue
                </button>
              </div>
            </div>
          ) : (
            /* Standard Checkout Form */
            <div className="checkoutLayoutGrid">
              {/* Left Column: Order Summary */}
              <div className="checkoutSummaryCol">
                <div className="checkoutPlanBadge">
                  <span>CHOSEN PLAN</span>
                  <h4>{plan.name}</h4>
                </div>

                {/* Institution Plan Toggle (Monthly vs Annual) */}
                {plan.id === 'institution' && (
                  <div className="billingCycleToggleWrap">
                    <button
                      type="button"
                      className={`cycleToggleBtn ${billingCycle === 'monthly' ? 'active' : ''}`}
                      onClick={() => setBillingCycle('monthly')}
                    >
                      Monthly (₹349/mo)
                    </button>
                    <button
                      type="button"
                      className={`cycleToggleBtn ${billingCycle === 'annual' ? 'active' : ''}`}
                      onClick={() => setBillingCycle('annual')}
                    >
                      Annual (₹2,999/yr)
                      <span className="saveBadge">Save ₹1,189</span>
                    </button>
                  </div>
                )}

                <div className="orderPriceSummary">
                  <div className="priceRow">
                    <span>Base Plan Fee</span>
                    <span>₹{currentPrice}.00</span>
                  </div>
                  <div className="priceRow">
                    <span>GST (18%)</span>
                    <span className="freeHighlight">Included (₹0 Extra)</span>
                  </div>
                  <div className="priceRow">
                    <span>Signova Platform Fee</span>
                    <span className="freeHighlight">₹0</span>
                  </div>
                  <div className="priceRowDivider" />
                  <div className="priceRow totalRow">
                    <span>Total Amount Payable</span>
                    <span className="totalAmountDisplay">₹{currentPrice}</span>
                  </div>
                </div>

                <div className="checkoutGuaranteeBox">
                  <div className="guaranteeItem">
                    <span className="guaranteeIcon">✓</span>
                    <span>Instant Pro unlock across all your devices</span>
                  </div>
                  <div className="guaranteeItem">
                    <span className="guaranteeIcon">✓</span>
                    <span>Cancel or switch plans anytime with 1-click</span>
                  </div>
                  <div className="guaranteeItem">
                    <span className="guaranteeIcon">✓</span>
                    <span>GST input tax credit compliant invoice</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Payment Methods & Inputs */}
              <div className="checkoutPaymentCol">
                <label className="checkoutColHeaderLabel">SELECT PAYMENT METHOD</label>

                {/* Tabs */}
                <div className="paymentMethodTabs">
                  <button
                    type="button"
                    className={`payMethodTab ${paymentMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => { setPaymentMethod('upi'); setErrorMessage(''); }}
                  >
                    <span className="tabIcon">⚡</span>
                    <div className="tabText">
                      <strong>UPI (Instant)</strong>
                      <small>GPay, PhonePe, Paytm, QR</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`payMethodTab ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => { setPaymentMethod('card'); setErrorMessage(''); }}
                  >
                    <span className="tabIcon">💳</span>
                    <div className="tabText">
                      <strong>Cards</strong>
                      <small>RuPay, Visa, MasterCard</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`payMethodTab ${paymentMethod === 'netbanking' ? 'active' : ''}`}
                    onClick={() => { setPaymentMethod('netbanking'); setErrorMessage(''); }}
                  >
                    <span className="tabIcon">🏛</span>
                    <div className="tabText">
                      <strong>Net Banking</strong>
                      <small>All Indian Banks</small>
                    </div>
                  </button>
                </div>

                {/* Method Content */}
                <div className="paymentMethodBody">
                  {/* --- 1. UPI METHOD --- */}
                  {paymentMethod === 'upi' && (
                    <div className="upiMethodContainer">
                      <div className="upiSubSwitcher">
                        <button
                          type="button"
                          className={`upiSubBtn ${upiMethod === 'qr' ? 'active' : ''}`}
                          onClick={() => setUpiMethod('qr')}
                        >
                          Scan UPI QR Code
                        </button>
                        <button
                          type="button"
                          className={`upiSubBtn ${upiMethod === 'vpa' ? 'active' : ''}`}
                          onClick={() => setUpiMethod('vpa')}
                        >
                          Enter UPI ID / VPA
                        </button>
                      </div>

                      {upiMethod === 'qr' ? (
                        <div className="upiQrDisplayBox">
                          <div className="simulatedUpiQr">
                            {/* Realistic SVG UPI QR Pattern */}
                            <svg viewBox="0 0 160 160" width="160" height="160" className="upiQrCodeSvg">
                              <rect width="160" height="160" fill="#ffffff" />
                              {/* Corner Position Detection Squares */}
                              <rect x="10" y="10" width="40" height="40" fill="#0f172a" rx="4" />
                              <rect x="18" y="18" width="24" height="24" fill="#ffffff" rx="2" />
                              <rect x="24" y="24" width="12" height="12" fill="#7c3aed" rx="1" />

                              <rect x="110" y="10" width="40" height="40" fill="#0f172a" rx="4" />
                              <rect x="118" y="18" width="24" height="24" fill="#ffffff" rx="2" />
                              <rect x="124" y="24" width="12" height="12" fill="#7c3aed" rx="1" />

                              <rect x="10" y="110" width="40" height="40" fill="#0f172a" rx="4" />
                              <rect x="18" y="118" width="24" height="24" fill="#ffffff" rx="2" />
                              <rect x="24" y="124" width="12" height="12" fill="#7c3aed" rx="1" />

                              {/* Matrix Pattern dots */}
                              <rect x="60" y="15" width="8" height="8" fill="#0f172a" />
                              <rect x="75" y="15" width="8" height="8" fill="#7c3aed" />
                              <rect x="90" y="15" width="8" height="8" fill="#0f172a" />
                              <rect x="60" y="30" width="8" height="8" fill="#7c3aed" />
                              <rect x="80" y="30" width="12" height="8" fill="#0f172a" />
                              <rect x="60" y="45" width="18" height="8" fill="#0f172a" />
                              <rect x="85" y="45" width="8" height="8" fill="#7c3aed" />

                              <rect x="15" y="60" width="10" height="8" fill="#7c3aed" />
                              <rect x="30" y="60" width="16" height="8" fill="#0f172a" />
                              <rect x="55" y="60" width="14" height="14" fill="#7c3aed" />
                              <rect x="75" y="60" width="10" height="10" fill="#0f172a" />
                              <rect x="95" y="60" width="25" height="8" fill="#0f172a" />
                              <rect x="130" y="60" width="15" height="10" fill="#7c3aed" />

                              {/* Center Logo */}
                              <circle cx="80" cy="80" r="16" fill="#ffffff" stroke="#7c3aed" strokeWidth="2.5" />
                              <text x="80" y="85" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#7c3aed">₹</text>

                              <rect x="15" y="80" width="24" height="8" fill="#0f172a" />
                              <rect x="45" y="80" width="10" height="14" fill="#7c3aed" />
                              <rect x="105" y="80" width="16" height="8" fill="#0f172a" />
                              <rect x="130" y="80" width="15" height="12" fill="#7c3aed" />

                              <rect x="60" y="105" width="20" height="8" fill="#7c3aed" />
                              <rect x="90" y="105" width="8" height="12" fill="#0f172a" />
                              <rect x="115" y="105" width="30" height="8" fill="#7c3aed" />

                              <rect x="60" y="125" width="10" height="10" fill="#0f172a" />
                              <rect x="80" y="125" width="20" height="8" fill="#7c3aed" />
                              <rect x="110" y="125" width="12" height="12" fill="#0f172a" />
                              <rect x="130" y="125" width="15" height="15" fill="#7c3aed" />
                            </svg>
                          </div>
                          <div className="upiQrInstructions">
                            <span className="upiAppLogosRow">
                              <span className="appTag gpay">GPay</span>
                              <span className="appTag phonepe">PhonePe</span>
                              <span className="appTag paytm">Paytm</span>
                              <span className="appTag bhim">BHIM UPI</span>
                            </span>
                            <p>Scan with any UPI app on your phone to approve <b>₹{currentPrice}</b></p>
                            <small className="qrExpiryCountdown">⏱ QR code valid for this session</small>
                          </div>
                        </div>
                      ) : (
                        <div className="upiVpaInputSection">
                          <label className="checkoutFormField">
                            <span>Your Virtual Payment Address (UPI ID)</span>
                            <div className="vpaInputWithVerify">
                              <input
                                type="text"
                                placeholder="e.g. yourname@okhdfcbank or mobile@paytm"
                                value={upiId}
                                onChange={(e) => {
                                  setUpiId(e.target.value);
                                  setUpiVerified(false);
                                }}
                                className="checkoutInput"
                              />
                              <button
                                type="button"
                                className="verifyVpaBtn"
                                onClick={handleVerifyUpi}
                              >
                                {upiVerified ? '✓ Verified' : 'Verify'}
                              </button>
                            </div>
                          </label>

                          <div className="popularUpiHandles">
                            <small>Popular handles:</small>
                            {['@oksbi', '@okhdfcbank', '@paytm', '@ybl', '@axl'].map((handle) => (
                              <button
                                key={handle}
                                type="button"
                                className="handlePill"
                                onClick={() => {
                                  const prefix = upiId.split('@')[0] || 'username';
                                  setUpiId(`${prefix}${handle}`);
                                  setUpiVerified(true);
                                }}
                              >
                                {handle}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- 2. CARD METHOD --- */}
                  {paymentMethod === 'card' && (
                    <div className="cardMethodContainer">
                      <div className="supportedCardsRow">
                        <span className="cardBrandBadge rupay">RuPay</span>
                        <span className="cardBrandBadge visa">VISA</span>
                        <span className="cardBrandBadge master">Mastercard</span>
                        <span className="cardBrandBadge amex">Amex</span>
                      </div>

                      <label className="checkoutFormField">
                        <span>Card Number</span>
                        <input
                          type="text"
                          placeholder="4532 •••• •••• 8921"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          className="checkoutInput"
                          maxLength={19}
                        />
                      </label>

                      <div className="cardRowDual">
                        <label className="checkoutFormField">
                          <span>Expiry (MM/YY)</span>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={handleExpiryChange}
                            className="checkoutInput"
                            maxLength={5}
                          />
                        </label>

                        <label className="checkoutFormField">
                          <span>CVV</span>
                          <input
                            type="password"
                            placeholder="•••"
                            value={cardCvv}
                            onChange={handleCvvChange}
                            className="checkoutInput"
                            maxLength={4}
                          />
                        </label>
                      </div>

                      <label className="checkoutFormField">
                        <span>Cardholder Name</span>
                        <input
                          type="text"
                          placeholder="Name as printed on card"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="checkoutInput"
                        />
                      </label>
                    </div>
                  )}

                  {/* --- 3. NET BANKING METHOD --- */}
                  {paymentMethod === 'netbanking' && (
                    <div className="netBankingContainer">
                      <small className="netBankingNote">Select your preferred Indian bank:</small>
                      <div className="popularBanksGrid">
                        {[
                          { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
                          { id: 'sbi', name: 'State Bank of India', code: 'SBI' },
                          { id: 'icici', name: 'ICICI Bank', code: 'ICICI' },
                          { id: 'axis', name: 'Axis Bank', code: 'AXIS' },
                          { id: 'kotak', name: 'Kotak Mahindra', code: 'KOTAK' },
                          { id: 'pnb', name: 'Punjab National', code: 'PNB' },
                        ].map((bank) => (
                          <button
                            key={bank.id}
                            type="button"
                            className={`bankSelectTile ${selectedBank === bank.id ? 'active' : ''}`}
                            onClick={() => setSelectedBank(bank.id)}
                          >
                            <span className="bankCode">{bank.code}</span>
                            <span className="bankName">{bank.name}</span>
                          </button>
                        ))}
                      </div>

                      <label className="checkoutFormField" style={{ marginTop: '12px' }}>
                        <span>Or search other Indian banks</span>
                        <select
                          className="checkoutInput"
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                        >
                          <option value="hdfc">HDFC Bank</option>
                          <option value="sbi">State Bank of India</option>
                          <option value="icici">ICICI Bank</option>
                          <option value="axis">Axis Bank</option>
                          <option value="kotak">Kotak Mahindra Bank</option>
                          <option value="pnb">Punjab National Bank</option>
                          <option value="bob">Bank of Baroda</option>
                          <option value="canara">Canara Bank</option>
                          <option value="indusind">IndusInd Bank</option>
                          <option value="yes">Yes Bank</option>
                          <option value="idbi">IDBI Bank</option>
                          <option value="union">Union Bank of India</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="checkoutErrorBanner">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Pay Action CTA */}
                <button
                  type="button"
                  className="checkoutSubmitPayBtn"
                  onClick={handlePayNow}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>Pay ₹{currentPrice} Securely</span>
                </button>

                <p className="checkoutPciNotice">
                  🔒 Signova uses 256-bit AES encryption. Verified Merchant integration.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
