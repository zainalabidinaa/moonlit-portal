import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-[13.5px] font-medium text-muted">{label}</label>}
      <input
        id={id}
        ref={ref}
        className={`h-[46px] w-full rounded-[10px] border bg-bg2 px-3.5 text-[15px] text-text outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:shadow-[0_0_0_3px_rgba(255,122,61,.12)]
          ${error ? 'border-red-400 focus:border-red-500' : 'border-border-strong focus:border-accent'} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';
