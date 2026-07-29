// ─────────────────────────────────────────────────────────────────────────────
// FormComponents.extended.jsx
// Drop into: frontend/src/components/common/FormComponents.extended.jsx
//
// Adds ERP-grade input primitives on top of the existing FormComponents.jsx.
// Import these alongside the existing exports — nothing in FormComponents.jsx
// is changed or broken.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, X, Check, Search, Plus, Trash2, AlertCircle } from 'lucide-react';

// ─── Re-export base primitives so consumers need only one import ──────────────
export {
  FormField, Input, Select, Textarea, Button, Card, CardHeader, CardBody, RequiredIndicatorProvider,
} from './FormComponents';

// ─────────────────────────────────────────────────────────────────────────────
// SectionCard  — coloured section header + card body used in multi-step forms
// ─────────────────────────────────────────────────────────────────────────────
export const SectionCard = ({ number, title, subtitle, icon: Icon, color = 'blue', active = false, children, className = '' }) => {
  const colors = {
    blue:   { ring: 'border-blue-200',   activeRing: 'ring-blue-300',   header: 'from-blue-50 to-indigo-50',   badge: 'bg-blue-600',    text: 'text-blue-700'   },
    indigo: { ring: 'border-indigo-200', activeRing: 'ring-indigo-300', header: 'from-indigo-50 to-blue-50',   badge: 'bg-indigo-600',  text: 'text-indigo-700' },
    orange: { ring: 'border-orange-200', activeRing: 'ring-orange-300', header: 'from-orange-50 to-amber-50',  badge: 'bg-orange-500',  text: 'text-orange-700' },
    green:  { ring: 'border-green-200',  activeRing: 'ring-green-300',  header: 'from-green-50 to-emerald-50', badge: 'bg-green-600',   text: 'text-green-700'  },
    purple: { ring: 'border-purple-200', activeRing: 'ring-purple-300', header: 'from-purple-50 to-violet-50', badge: 'bg-purple-600',  text: 'text-purple-700' },
    cyan:   { ring: 'border-cyan-200',   activeRing: 'ring-cyan-300',   header: 'from-cyan-50 to-sky-50',      badge: 'bg-cyan-600',    text: 'text-cyan-700'   },
    rose:   { ring: 'border-rose-200',   activeRing: 'ring-rose-300',   header: 'from-rose-50 to-pink-50',     badge: 'bg-rose-600',    text: 'text-rose-700'   },
    slate:  { ring: 'border-slate-200',  activeRing: 'ring-slate-300',  header: 'from-slate-50 to-gray-50',    badge: 'bg-slate-600',   text: 'text-slate-700'  },
    amber:  { ring: 'border-amber-200',  activeRing: 'ring-amber-300',  header: 'from-amber-50 to-yellow-50',  badge: 'bg-amber-600',   text: 'text-amber-700'  },
  };
  const c = colors[color] || colors.blue;

  return (
    // <div className={`bg-white rounded-xl border ${c.ring} shadow-sm overflow-visible transition-all duration-200 ${active ? `ring-2 ring-offset-1 ${c.activeRing} shadow-md` : ''} ${className}`}>
    // <div className={`bg-white rounded-xl border ${c.ring} shadow-sm ${className}`}>
    // {/* Section Header */}
    //   <div className={`bg-gradient-to-r ${c.header} px-6 py-4 border-b ${c.ring} flex items-center gap-3`}>
    <div className={`bg-white rounded-xl border ${c.ring} shadow-sm overflow-visible transition-all duration-200 ${active ? `ring-2 ring-offset-1 ${c.activeRing} shadow-md` : ''} ${className}`}>
      {/* Section Header */}
      <div className={`bg-gradient-to-r ${c.header} rounded-t-xl px-4 py-3 sm:px-6 sm:py-4 border-b ${c.ring} flex flex-wrap items-center gap-3`}>
        {number ? (
          <div
            className={`${c.badge} flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-bold text-white shadow-sm flex-shrink-0 whitespace-nowrap`}
          >
            {number}
          </div>
        ) : Icon ? (
          <div className="rounded-xl bg-white/80 p-2 shadow-sm flex-shrink-0">
            <Icon size={18} className={c.text} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className={`break-words font-semibold ${c.text} text-sm`}>{title}</h3>
          {subtitle && <p className="mt-0.5 break-words text-xs text-gray-500">{subtitle}</p>}
        </div>
        {number && Icon && <Icon size={18} className={`ml-auto ${c.text} opacity-40`} />}
      </div>
      {/* Body */}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FormField  (extended — wraps label + error same as base but exported here)
// ─────────────────────────────────────────────────────────────────────────────
export const ExtendedFormField = ({ label, error, required, hint, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && (
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1">
        <AlertCircle size={11} /> {error}
      </p>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AutocompleteInput  — text input with dropdown suggestion list
// Props:
//   value, onChange(string), suggestions: string[], placeholder, error
// ─────────────────────────────────────────────────────────────────────────────
export const AutocompleteInput = ({
  value = '',
  onChange,
  suggestions = [],
  placeholder = '',
  error,
  className = '',
  disabled = false,
  ...rest
}) => {
  const [open,          setOpen]          = useState(false);
  const [query,         setQuery]         = useState(value);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  // Sync external value changes (e.g. auto-fill from extraction)
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset highlight when dropdown closes or filtered list changes
  useEffect(() => {
    if (!open) setHighlightedIdx(-1);
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-ac-item]');
    items[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx]);

  const filtered = query.length >= 1
    ? suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  const handleInput = (e) => {
    setQuery(e.target.value);
    onChange(e.target.value);
    setHighlightedIdx(-1);
    setOpen(true);
  };

  const pick = (s) => {
    setQuery(s);
    onChange(s);
    setOpen(false);
    setHighlightedIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIdx >= 0 && highlightedIdx < filtered.length) {
          pick(filtered[highlightedIdx]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => filtered.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 text-base sm:text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-500
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'}
          ${className}`}
        {...rest}
      />
      {open && filtered.length > 0 && (
        <ul ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto text-sm">
          {filtered.map((s, i) => (
            <li
              key={i}
              data-ac-item
              onMouseDown={() => pick(s)}
              className={`px-3 py-2 cursor-pointer transition-colors flex items-center gap-2
                ${i === highlightedIdx ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50 hover:text-blue-700'}`}
            >
              <Search size={12} className="text-gray-300 flex-shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SearchableSelect  — filterable dropdown replacing native <select>
// Props:
//   value, onChange(value), options: [{value, label}] | string[], placeholder
// ─────────────────────────────────────────────────────────────────────────────
export const SearchableSelect = ({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select…',
  error,
  className = '',
  disabled = false,
  includeNotApplicable = false,
  notApplicableValue = 'NA - Not Applicable',
}) => {
  const [open,      setOpen]      = useState(false);
  const [search,    setSearch]    = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);   // keyboard highlight
  const wrapRef   = useRef(null);
  const searchRef = useRef(null);
  const listRef   = useRef(null);

  const baseOptions = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const normalised = includeNotApplicable && !baseOptions.some((option) => option?.value === notApplicableValue)
    ? [...baseOptions, { value: notApplicableValue, label: notApplicableValue }]
    : baseOptions;

  const selectedLabel = normalised.find(o => o.value === value)?.label || '';

  // Include the blank "clear" option at index 0 in keyboard nav
  const filtered = normalised.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );
  // full list for keyboard: [clear, ...filtered]
  const navList = [{ value: '', label: placeholder, _clear: true }, ...filtered];

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
    if (!open) { setSearch(''); setActiveIdx(-1); }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-nav-item]');
    items[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const pick = (v) => { onChange(v); setSearch(''); setOpen(false); setActiveIdx(-1); };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, navList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < navList.length) {
          pick(navList[activeIdx].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-3 py-2 text-base sm:text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 text-left
          ${error ? 'border-red-400' : 'border-gray-300'}
          ${!selectedLabel ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Search inside dropdown */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setActiveIdx(-1); }}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <ul ref={listRef} className="max-h-52 overflow-y-auto text-sm">
            {/* Clear option */}
            <li
              data-nav-item
              onMouseDown={() => pick('')}
              className={`px-3 py-2 cursor-pointer italic text-xs transition-colors
                ${activeIdx === 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              {placeholder}
            </li>
            {filtered.map((o, i) => {
              const navIdx = i + 1; // offset for the clear item
              return (
                <li
                  key={o.value}
                  data-nav-item
                  onMouseDown={() => pick(o.value)}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 transition-colors
                    ${activeIdx === navIdx
                      ? 'bg-blue-100 text-blue-700'
                      : value === o.value
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                >
                  {value === o.value && <Check size={13} className="flex-shrink-0" />}
                  <span>{o.label}</span>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-gray-400">No results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MultiCheckSelect  — select multiple options as pill tags (panel types, etc.)
// Props:
//   value: string[], onChange(string[]), options: [{value, label}] | string[]
// ─────────────────────────────────────────────────────────────────────────────
export const MultiCheckSelect = ({
  value = [],
  onChange,
  options = [],
  placeholder = 'Select options…',
  error,
  maxSelect,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const normalised = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v) => {
    if (value.includes(v)) {
      onChange(value.filter(x => x !== v));
    } else {
      if (maxSelect && value.length >= maxSelect) return;
      onChange([...value, v]);
    }
  };

  const remove = (v, e) => { e.stopPropagation(); onChange(value.filter(x => x !== v)); };

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => setOpen(!open)}
        className={`min-h-[40px] w-full px-3 py-1.5 text-base sm:text-sm border rounded-lg bg-white cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 flex flex-wrap gap-1 items-center
          ${error ? 'border-red-400' : 'border-gray-300'}`}
      >
        {value.length === 0 && (
          <span className="text-gray-400 text-sm py-0.5">{placeholder}</span>
        )}
        {value.map(v => {
          const label = normalised.find(o => o.value === v)?.label || v;
          return (
            <span key={v} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {label}
              <button type="button" onMouseDown={(e) => remove(v, e)} className="hover:text-blue-600">
                <X size={11} />
              </button>
            </span>
          );
        })}
        <ChevronDown size={14} className={`ml-auto text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto text-sm">
          {normalised.map(o => {
            const selected = value.includes(o.value);
            return (
              <div
                key={o.value}
                onMouseDown={() => toggle(o.value)}
                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors
                  ${selected ? 'bg-blue-50' : ''}`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                  ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {selected && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <span className={selected ? 'text-blue-700 font-medium' : 'text-gray-700'}>{o.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DynamicLoadTable  — add/remove rows for Load Details section
//
// Columns: Sr | Load Description | Qty | kW | HP | Ampere | Remarks | ✕
// Auto-calculation rules (editing any one value updates the other two):
//   HP     = kW / 0.746
//   Ampere = (kW × 1000) / 575
//   kW     = HP × 0.746          (when HP is edited)
//   kW     = (A × 575) / 1000    (when Ampere is edited)
// ─────────────────────────────────────────────────────────────────────────────
export const DynamicLoadTable = ({ rows = [], onChange }) => {
  const round2 = (n) => Math.round(n * 100) / 100;

  const addRow = () => {
    onChange([...rows, {
      id: Date.now() + Math.random(),
      description: '',
      qty: '',
      kw: '',
      hp: '',
      ampere: '',
      remarks: '',
    }]);
  };

  // Update a single field and auto-derive the other two power columns
  const updateRow = (id, field, rawVal) => {
    const val = rawVal === '' ? '' : rawVal;
    onChange(rows.map(r => {
      if (r.id !== id) return r;
      const num = parseFloat(val);
      const valid = !isNaN(num) && num >= 0;

      if (field === 'kw') {
        return {
          ...r,
          kw:     val,
          hp:     valid ? String(round2(num / 0.746))         : '',
          ampere: valid ? String(round2((num * 1000) / 575))  : '',
        };
      }
      if (field === 'hp') {
        const kwDerived = valid ? round2(num * 0.746) : '';
        return {
          ...r,
          hp:     val,
          kw:     valid ? String(kwDerived)                                  : '',
          ampere: valid ? String(round2((kwDerived * 1000) / 575))           : '',
        };
      }
      if (field === 'ampere') {
        const kwDerived = valid ? round2((num * 575) / 1000) : '';
        return {
          ...r,
          ampere: val,
          kw:     valid ? String(kwDerived)                                  : '',
          hp:     valid ? String(round2(kwDerived / 0.746))                  : '',
        };
      }
      // non-power fields — pass through unchanged
      return { ...r, [field]: val };
    }));
  };

  const removeRow = (id) => {
    onChange(rows.filter(r => r.id !== id));
  };

  const td  = 'px-2 py-1 align-middle';
  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white placeholder-gray-300';
  // Calculated fields get a slightly distinct background to signal read-only-ish
  const inpCalc = `${inp} bg-slate-50 text-slate-600`;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs" style={{ minWidth: '720px' }}>
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-3 py-2.5 text-left font-semibold w-10">Sr.</th>
              <th className="px-3 py-2.5 text-left font-semibold">Load Description</th>
              <th className="px-3 py-2.5 text-center font-semibold w-16">Qty</th>
              {/* Power trio — colour-coded header */}
              <th className="px-2 py-2.5 text-center font-semibold w-24 bg-blue-700">kW</th>
              <th className="px-2 py-2.5 text-center font-semibold w-24 bg-indigo-700">HP</th>
              <th className="px-2 py-2.5 text-center font-semibold w-24 bg-cyan-700">Ampere</th>
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
            {/* Sub-header hint */}
            <tr className="bg-slate-700 text-slate-300 text-[10px]">
              <td colSpan={3}></td>
              <td className="px-2 py-1 text-center text-blue-300">edit any one</td>
              <td className="px-2 py-1 text-center text-indigo-300">auto-fills</td>
              <td className="px-2 py-1 text-center text-cyan-300">other two</td>
              <td colSpan={2}></td>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 italic text-xs">
                  No loads added. Click "Add Load Row" below.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.id} className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className={td}>
                  <span className="font-mono text-gray-400">{String(idx + 1).padStart(2, '0')}</span>
                </td>
                <td className={td}>
                  <input
                    type="text"
                    value={row.description}
                    onChange={e => updateRow(row.id, 'description', e.target.value)}
                    placeholder="e.g. Main Motor, Pump, Conveyor…"
                    className={inp}
                  />
                </td>
                <td className={td}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.qty}
                    onChange={e => updateRow(row.id, 'qty', e.target.value)}
                    placeholder="0"
                    min="0"
                    className={`${inp} text-center`}
                  />
                </td>
                {/* kW — primary input, blue tint when filled */}
                <td className={`${td} bg-blue-50/40`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.kw}
                    onChange={e => updateRow(row.id, 'kw', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inp} text-center border-blue-200 focus:ring-blue-500`}
                  />
                </td>
                {/* HP — derived, still editable */}
                <td className={`${td} bg-indigo-50/40`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.hp}
                    onChange={e => updateRow(row.id, 'hp', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inp} text-center border-indigo-200 focus:ring-indigo-500`}
                  />
                </td>
                {/* Ampere — derived, still editable */}
                <td className={`${td} bg-cyan-50/40`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={row.ampere}
                    onChange={e => updateRow(row.id, 'ampere', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${inp} text-center border-cyan-200 focus:ring-cyan-500`}
                  />
                </td>
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove row"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-dashed border-blue-300 hover:border-blue-500"
      >
        <Plus size={13} /> Add Load Row
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ControlMatrixTable  — checkbox + brand + model per component
// ─────────────────────────────────────────────────────────────────────────────
export const ControlMatrixTable = ({ components, value = {}, onChange }) => {
  const update = (key, field, val) => {
    onChange({
      ...value,
      [key]: { ...(value[key] || { required: false, brand: '', model: '' }), [field]: val },
    });
  };

  const thClass = 'px-3 py-2.5 text-left text-xs font-semibold text-white uppercase tracking-wide';
  const tdClass = 'px-3 py-2 align-middle';
  const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white';

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-800">
            <th className={thClass} style={{ width: '220px' }}>Component</th>
            <th className={thClass} style={{ width: '90px' }}>Required</th>
            <th className={thClass}>Preferred Brand</th>
            <th className={thClass}>Suggested Model</th>
          </tr>
        </thead>
        <tbody>
          {components.map((comp, idx) => {
            const row = value[comp.key] || { required: false, brand: '', model: '' };
            return (
              <tr key={comp.key} className={`border-t border-gray-100 transition-colors ${row.required ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className={tdClass}>
                  <span className={`font-medium ${row.required ? 'text-blue-800' : 'text-gray-700'}`}>
                    {comp.label}
                  </span>
                </td>
                <td className={tdClass}>
                  <label className="flex items-center justify-center cursor-pointer">
                    <div
                      onClick={() => update(comp.key, 'required', !row.required)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${row.required ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}
                    >
                      {row.required && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                  </label>
                </td>
                <td className={tdClass}>
                  {row.required ? (
                    <AutocompleteInput
                      value={row.brand}
                      onChange={v => update(comp.key, 'brand', v)}
                      suggestions={comp.brands}
                      placeholder="Select or type brand…"
                    />
                  ) : (
                    <span className="text-gray-300 italic text-xs px-2">—</span>
                  )}
                </td>
                <td className={tdClass}>
                  {row.required ? (
                    <input
                      type="text"
                      value={row.model}
                      onChange={e => update(comp.key, 'model', e.target.value)}
                      placeholder="Model / part number…"
                      className={inputClass}
                    />
                  ) : (
                    <span className="text-gray-300 italic text-xs px-2">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// DocumentUploader removed — AI document extraction feature not required in this build.

// ─────────────────────────────────────────────────────────────────────────────
// FormDivider  — visual horizontal section separator
// ─────────────────────────────────────────────────────────────────────────────
export const FormDivider = ({ label }) => (
  <div className="flex items-center gap-3 my-2">
    <div className="flex-1 h-px bg-gray-100" />
    {label && <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{label}</span>}
    <div className="flex-1 h-px bg-gray-100" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// InlineToggle  — Yes / No toggle chip pair
// ─────────────────────────────────────────────────────────────────────────────
export const InlineToggle = ({ value, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
    <button
      type="button"
      onClick={() => onChange(true)}
      className={`px-3 py-1.5 transition-colors ${value === true ? 'bg-green-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
    >
      {yesLabel}
    </button>
    <button
      type="button"
      onClick={() => onChange(false)}
      className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${value === false ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
    >
      {noLabel}
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// StepProgressBar  — compact horizontal section stepper
// Sticky positioning is controlled by the page, not by this shared component.
// ─────────────────────────────────────────────────────────────────────────────
export const StepProgressBar = ({ steps = [], currentStep = 0, onStepClick, align = 'start' }) => {
  const scrollRef = useRef(null);
  const activeRef = useRef(null);

  // Keep the active step in view when it changes (matters on mobile where the
  // bar is a single horizontally-scrolling row rather than wrapping).
  useEffect(() => {
    const el = activeRef.current;
    const container = scrollRef.current;
    if (!el || !container) return;

    // Only act when the row actually overflows (i.e. mobile/tablet scroll mode).
    // On desktop the row wraps with overflow-visible, so scrollWidth ≈ clientWidth
    // and we must NOT scroll — otherwise it jumps to the middle.
    if (container.scrollWidth <= container.clientWidth + 1) return;

    // Measure with bounding rects so the result is independent of which ancestor
    // happens to be positioned (offsetLeft was the bug — it included the header
    // offset and pushed step 1 off-screen).
    const elRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const delta =
      elRect.left - cRect.left - (container.clientWidth / 2 - el.offsetWidth / 2);

    const target = Math.max(0, container.scrollLeft + delta);
    if (Math.abs(target - container.scrollLeft) > 1) {
      container.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, [currentStep, steps.length]);

  if (!Array.isArray(steps) || steps.length === 0) return null;

  const colorStyles = {
    blue: {
      active: 'bg-blue-600 text-white shadow-sm',
      done: 'bg-blue-100 text-blue-700',
      activeCircle: 'bg-white text-blue-600',
      doneCircle: 'bg-blue-500 text-white',
      line: 'bg-blue-300',
    },
    green: {
      active: 'bg-green-600 text-white shadow-sm',
      done: 'bg-green-100 text-green-700',
      activeCircle: 'bg-white text-green-600',
      doneCircle: 'bg-green-500 text-white',
      line: 'bg-green-300',
    },
    purple: {
      active: 'bg-purple-600 text-white shadow-sm',
      done: 'bg-purple-100 text-purple-700',
      activeCircle: 'bg-white text-purple-600',
      doneCircle: 'bg-purple-500 text-white',
      line: 'bg-purple-300',
    },
    emerald: {
      active: 'bg-emerald-600 text-white shadow-sm',
      done: 'bg-emerald-100 text-emerald-700',
      activeCircle: 'bg-white text-emerald-600',
      doneCircle: 'bg-emerald-500 text-white',
      line: 'bg-emerald-300',
    },
    violet: {
      active: 'bg-violet-600 text-white shadow-sm',
      done: 'bg-violet-100 text-violet-700',
      activeCircle: 'bg-white text-violet-600',
      doneCircle: 'bg-violet-500 text-white',
      line: 'bg-violet-300',
    },
    cyan: {
      active: 'bg-cyan-600 text-white shadow-sm',
      done: 'bg-cyan-100 text-cyan-700',
      activeCircle: 'bg-white text-cyan-600',
      doneCircle: 'bg-cyan-500 text-white',
      line: 'bg-cyan-300',
    },
    amber: {
      active: 'bg-amber-600 text-white shadow-sm',
      done: 'bg-amber-100 text-amber-700',
      activeCircle: 'bg-white text-amber-600',
      doneCircle: 'bg-amber-500 text-white',
      line: 'bg-amber-300',
    },
    slate: {
      active: 'bg-slate-600 text-white shadow-sm',
      done: 'bg-slate-100 text-slate-700',
      activeCircle: 'bg-white text-slate-600',
      doneCircle: 'bg-slate-500 text-white',
      line: 'bg-slate-300',
    },
    rose: {
      active: 'bg-rose-600 text-white shadow-sm',
      done: 'bg-rose-100 text-rose-700',
      activeCircle: 'bg-white text-rose-600',
      doneCircle: 'bg-rose-500 text-white',
      line: 'bg-rose-300',
    },
    indigo: {
      active: 'bg-indigo-600 text-white shadow-sm',
      done: 'bg-indigo-100 text-indigo-700',
      activeCircle: 'bg-white text-indigo-600',
      doneCircle: 'bg-indigo-500 text-white',
      line: 'bg-indigo-300',
    },
    teal: {
      active: 'bg-teal-600 text-white shadow-sm',
      done: 'bg-teal-100 text-teal-700',
      activeCircle: 'bg-white text-teal-600',
      doneCircle: 'bg-teal-500 text-white',
      line: 'bg-teal-300',
    },
    orange: {
      active: 'bg-orange-500 text-white shadow-sm',
      done: 'bg-orange-100 text-orange-700',
      activeCircle: 'bg-white text-orange-600',
      doneCircle: 'bg-orange-500 text-white',
      line: 'bg-orange-300',
    },
    fuchsia: {
      active: 'bg-fuchsia-600 text-white shadow-sm',
      done: 'bg-fuchsia-100 text-fuchsia-700',
      activeCircle: 'bg-white text-fuchsia-600',
      doneCircle: 'bg-fuchsia-500 text-white',
      line: 'bg-fuchsia-300',
    },
    sky: {
      active: 'bg-sky-600 text-white shadow-sm',
      done: 'bg-sky-100 text-sky-700',
      activeCircle: 'bg-white text-sky-600',
      doneCircle: 'bg-sky-500 text-white',
      line: 'bg-sky-300',
    },
    lime: {
      active: 'bg-lime-600 text-white shadow-sm',
      done: 'bg-lime-100 text-lime-700',
      activeCircle: 'bg-white text-lime-600',
      doneCircle: 'bg-lime-500 text-white',
      line: 'bg-lime-300',
    },
    red: {
      active: 'bg-red-600 text-white shadow-sm',
      done: 'bg-red-100 text-red-700',
      activeCircle: 'bg-white text-red-600',
      doneCircle: 'bg-red-500 text-white',
      line: 'bg-red-300',
    },
  };

  const alignmentClass = align === 'end' ? 'justify-end' : 'justify-start';

  return (
    <div className="w-full min-w-0 max-w-full">
      <div
        ref={scrollRef}
        className={`relative flex flex-nowrap items-center ${alignmentClass} gap-x-1.5 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-wrap xl:justify-end xl:gap-y-1 xl:overflow-visible`}
      >
        {steps.map((step, i) => {
          const label = typeof step === 'string' ? step : step?.label || '';
          const color = typeof step === 'string' ? 'blue' : step?.color || 'blue';
          const style = colorStyles[color] || colorStyles.blue;
          const done = i < currentStep;
          const active = i === currentStep;

          return (
            <React.Fragment key={`${label}-${i}`}>
              <button
                ref={active ? activeRef : null}
                type="button"
                onClick={() => onStepClick?.(i)}
                aria-current={active ? 'step' : undefined}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-medium transition-all cursor-pointer hover:opacity-90 sm:px-2.5 sm:text-xs ${
                  done
                    ? style.done
                    : active
                      ? style.active
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                <span
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? style.doneCircle
                      : active
                        ? style.activeCircle
                        : 'bg-gray-300 text-white'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="whitespace-nowrap">
                  {label}
                </span>
              </button>

              {i < steps.length - 1 && (
                <div
                  className={`h-px w-4 flex-shrink-0 ${
                    done ? style.line : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
