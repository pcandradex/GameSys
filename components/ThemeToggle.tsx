"use client";

interface ThemeToggleProps {
  darkMode: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({
  darkMode,
  onToggle
}: ThemeToggleProps) {
  return (
    <button
      type="button"
      className={`theme-toggle ${darkMode ? "dark" : "light"}`}
      onClick={onToggle}
      aria-label="Alternar tema"
      aria-pressed={darkMode}
    >
      <span className="theme-icon moon" aria-hidden="true">
        <MoonIcon />
      </span>

      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb">
          {darkMode ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>

      <span className="theme-icon sun" aria-hidden="true">
        <SunIcon />
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15.5C20.1 15.8 19.1 16 18 16C12.5 16 8 11.5 8 6C8 4.9 8.2 3.9 8.5 3C4.6 4.4 2 8.1 2 12.5C2 18.3 6.7 23 12.5 23C16.9 23 20.6 20.4 22 16.5C21.7 16.2 21.4 15.8 21 15.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}