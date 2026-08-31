"use client";

import { useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return localStorage.getItem("gamesys-theme") !== "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );

    localStorage.setItem(
      "gamesys-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  return (
    <main className="login-page">
      <div className="background" aria-hidden="true">
        <div className="background-glow glow-one" />
        <div className="background-glow glow-two" />
        <div className="background-glow glow-three" />

        <div className="game-grid">
          <span>STEAM</span>
          <span>GAMES</span>
          <span>PLAY</span>
          <span>ONLINE</span>
          <span>GAMING</span>
          <span>LEVEL UP</span>
          <span>PLAYER</span>
          <span>COMMUNITY</span>
          <span>GAME ON</span>
        </div>

        <div className="background-overlay" />
      </div>

      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <GameControllerIcon />
          </div>

          <div className="brand-name">
            Game<span>Sys</span>
          </div>
        </div>

        <ThemeToggle
          darkMode={darkMode}
          onToggle={() => setDarkMode((value) => !value)}
        />
      </header>

      <section className="login-container">
        <LoginForm />
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} GameSys</span>
        <span className="footer-separator">•</span>
        <span>Game Management System</span>
      </footer>
    </main>
  );
}

function GameControllerIcon() {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.5 17H33.5C39.3 17 43.8 22.1 43 27.8L41.7 36.4C41.3 39.2 38.9 41 36.1 40.4C34.7 40.1 33.5 39.2 32.7 38L29.8 33.5H18.2L15.3 38C14.5 39.2 13.3 40.1 11.9 40.4C9.1 41 6.7 39.2 6.3 36.4L5 27.8C4.2 22.1 8.7 17 14.5 17Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 25V31"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M11 28H17"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="34" cy="26" r="1.7" fill="currentColor" />
      <circle cx="38" cy="30" r="1.7" fill="currentColor" />
    </svg>
  );
}