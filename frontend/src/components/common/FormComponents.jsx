import React, { createContext, useContext } from 'react';

const RequiredIndicatorContext = createContext(false);

export const RequiredIndicatorProvider = ({ hide = false, children }) => (
  <RequiredIndicatorContext.Provider value={Boolean(hide)}>
    {children}
  </RequiredIndicatorContext.Provider>
);

// Input field
export const FormField = ({ label, error, required, children, className = '', ...rest }) => {
  const hasError = Boolean(error);
  const hideRequiredIndicator = useContext(RequiredIndicatorContext);

  return (
    <div
      className={`flex flex-col gap-1 scroll-mt-52 scroll-mb-40 rounded-xl transition-colors ${
        hasError
          ? 'inquiry-validation-error -m-2 border border-red-200 bg-red-50/60 p-2 [&_button]:!border-red-400 [&_input]:!border-red-400 [&_select]:!border-red-400 [&_textarea]:!border-red-400'
          : ''
      } ${className}`}
      data-field-error={hasError ? 'true' : undefined}
      {...rest}
    >
      {label && (
        <label className={`text-sm font-medium ${hasError ? 'text-red-700' : 'text-gray-700'}`}>
          {label}
          {required && !hideRequiredIndicator && <span className="required-field-star ml-1 text-red-500">*</span>}
        </label>
      )}
      {children}
      {hasError && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
};

// Text input
// NOTE: `text-base sm:text-sm` keeps the font ≥16px on mobile, which prevents
// iOS Safari from auto-zooming (and shifting the layout) when an input is focused.
export const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-gray-400 ${className}`}
    {...props}
  />
);

// Select dropdown
export const Select = ({ children, className = '', ...props }) => (
  <select
    className={`w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${className}`}
    {...props}
  >
    {children}
  </select>
);

// Textarea
export const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full px-3 py-2 text-base sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-gray-400 resize-none ${className}`}
    rows={3}
    {...props}
  />
);

// Button
export const Button = ({ variant = 'primary', size = 'md', loading, children, className = '', ...props }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    success: 'bg-green-600 text-white hover:bg-green-700',
  };
  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-2.5',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
};

// Card
export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

// CardHeader — wraps actions below the title on narrow screens instead of crushing them.
export const CardHeader = ({ title, subtitle, actions, className = '' }) => (
  <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-gray-100 ${className}`}>
    <div className="min-w-0">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`p-4 sm:p-6 ${className}`}>{children}</div>
);
