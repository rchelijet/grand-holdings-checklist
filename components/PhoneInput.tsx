"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  COUNTRY_CODES,
  filterCountries,
  findCountryByDialCode,
  type CountryCode,
} from "@/lib/country-codes";
import { formatE164, parsePhone } from "@/lib/phone";

const inputClassName =
  "w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

function countryLabel(country: CountryCode): string {
  return `(${country.dialCode}) ${country.name}`;
}

export function PhoneInput({ label, value, onChange, required }: PhoneInputProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dialCode, setDialCode] = useState("+27");
  const [national, setNational] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    const parsed = parsePhone(value);
    setDialCode(parsed.dialCode);
    setNational(parsed.national);
  }, [value]);

  const selectedCountry = findCountryByDialCode(dialCode) ?? COUNTRY_CODES[0];
  const filteredCountries = filterCountries(countryQuery);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [dropdownOpen]);

  function emitChange(nextDialCode: string, nextNational: string) {
    onChange(formatE164(nextDialCode, nextNational));
  }

  function selectCountry(country: CountryCode) {
    setDialCode(country.dialCode);
    setCountryQuery("");
    setDropdownOpen(false);
    setHighlightIndex(0);
    emitChange(country.dialCode, national);
  }

  function handleNationalChange(nextNational: string) {
    const digitsOnly = nextNational.replace(/\D/g, "");
    setNational(digitsOnly);
    emitChange(dialCode, digitsOnly);
  }

  function handleCountryKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
      setDropdownOpen(true);
      return;
    }
    if (!dropdownOpen) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filteredCountries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = filteredCountries[highlightIndex];
      if (country) selectCountry(country);
    } else if (event.key === "Escape") {
      setDropdownOpen(false);
    }
  }

  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
        {label}
      </span>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div ref={containerRef} className="relative">
          <input
            className={inputClassName}
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Search country…"
            value={dropdownOpen ? countryQuery : countryLabel(selectedCountry)}
            onFocus={() => {
              setDropdownOpen(true);
              setCountryQuery("");
              setHighlightIndex(0);
            }}
            onChange={(e) => {
              setCountryQuery(e.target.value);
              setDropdownOpen(true);
              setHighlightIndex(0);
            }}
            onKeyDown={handleCountryKeyDown}
            required={required && !national}
          />
          {dropdownOpen && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-forest/15 bg-white py-1 shadow-lg"
            >
              {filteredCountries.length === 0 ? (
                <li className="px-3.5 py-2 text-sm text-forest/60">No matches</li>
              ) : (
                filteredCountries.map((country, index) => (
                  <li key={country.iso} role="option" aria-selected={index === highlightIndex}>
                    <button
                      type="button"
                      className={`w-full px-3.5 py-2 text-left text-sm hover:bg-cream ${
                        index === highlightIndex ? "bg-cream" : ""
                      } ${country.dialCode === dialCode ? "font-medium text-forest" : "text-forest/80"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCountry(country)}
                    >
                      ({country.dialCode}) {country.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <input
          className={inputClassName}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="767771900"
          value={national}
          onChange={(e) => handleNationalChange(e.target.value)}
          required={required}
        />
      </div>
    </label>
  );
}
