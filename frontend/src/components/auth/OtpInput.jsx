import { useRef, useEffect } from 'react';

/**
 * Renders 6 individual OTP input boxes with auto-focus-next + backspace support.
 * @prop {string[]} value - Array of 6 single-char strings e.g. ['1','2','','','','']
 * @prop {(index: number, char: string) => void} onChange
 */
export default function OtpInput({ value, onChange }) {
  const refs = useRef([]);

  // Auto-focus the first empty cell on mount
  useEffect(() => {
    const firstEmpty = value.findIndex((v) => v === '');
    const idx = firstEmpty === -1 ? 5 : firstEmpty;
    refs.current[idx]?.focus();
  }, [value]);

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (value[index] !== '') {
        onChange(index, '');
      } else if (index > 0) {
        onChange(index - 1, '');
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleChange = (e, index) => {
    const raw = e.target.value.replace(/\D/g, ''); // digits only
    if (!raw) return;
    // Handle paste of full OTP into a single cell
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (i < 6) onChange(i, d);
      });
      refs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    onChange(index, raw);
    if (index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((d, i) => onChange(i, d));
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className="otp-group" onPaste={handlePaste}>
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (refs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={digit}
          className={`otp-cell${digit ? ' filled' : ''}`}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          autoComplete="one-time-code"
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}
