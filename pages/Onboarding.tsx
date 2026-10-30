import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppIcon } from "../components/ui/Icons";
import {
  OnboardingArt,
  OnboardingBotanicals,
} from "../components/ui/OnboardingArt";
import { CycleDial } from "../components/ui/CycleDial";
import { localDateKey } from "../lib/dates";
import { useToday } from "../hooks/useToday";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { useAppMotion } from "../hooks/useAppMotion";
import { springs, motionTransition } from "../lib/motion";

export default function Onboarding() {
  const navigate = useNavigate(),
    { updateSettings } = useData(),
    { user } = useAuth(),
    today = useToday(),
    { reduced } = useAppMotion();
  const [step, setStep] = useState(0),
    [lastPeriodDate, setLastPeriodDate] = useState<Date | null>(null),
    [cycleLength, setCycleLength] = useState(28),
    [periodLength, setPeriodLength] = useState(5),
    [loading, setLoading] = useState(false),
    [saveError, setSaveError] = useState(""),
    [viewDate, setViewDate] = useState(new Date());
  React.useEffect(() => {
    if (user?.role === "partner")
      navigate("/partner/dashboard", { replace: true });
  }, [user?.role, navigate]);
  const finish = async () => {
    if (!lastPeriodDate || loading) return;
    if (localDateKey(lastPeriodDate) > today) {
      setStep(1);
      setSaveError("Choose a period start date that is today or earlier.");
      return;
    }
    setLoading(true);
    setSaveError("");
    try {
      await updateSettings({
        avgCycleLength: cycleLength,
        avgPeriodLength: periodLength,
        lastPeriodStart: localDateKey(lastPeriodDate),
        onboardingCompleted: true,
      });
      navigate("/");
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "Could not save your settings. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  };
  const year = viewDate.getFullYear(),
    month = viewDate.getMonth(),
    count = new Date(year, month + 1, 0).getDate(),
    first = new Date(year, month, 1).getDay();
  const heading = [
    "Welcome",
    "When did your last period start?",
    "How long is your cycle?",
    "How long does it last?",
  ][step];
  const subtitle = [
    "A little care starts with understanding your rhythm. Add your cycle history to get started.",
    "Choose the first day of bleeding. You can update it later.",
    "Choose your usual cycle length. An estimate is okay.",
    "Choose how many days your period usually lasts.",
  ][step];
  return (
    <main className="onboarding-garden safe-screen">
      <OnboardingBotanicals />
      <header className="onboarding-top">
        <button
          aria-label="Back"
          disabled={step === 0 || loading}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <AppIcon name="arrow_back" size={24} />
        </button>
        <span>YOUR RHYTHM, YOUR PACE</span>
      </header>
      <motion.div
        key={step}
        className="onboarding-stage"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={motionTransition(springs.section, reduced)}
      >
        <OnboardingArt
          variant={
            step === 0
              ? "welcome"
              : step === 2
                ? "cycle"
                : step === 3
                  ? "period"
                  : "privacy"
          }
        />
        <h1>{heading}</h1>
        <p className="onboarding-intro">{subtitle}</p>
        {step === 1 && (
          <section
            className="onboarding-calendar"
            aria-label="Period start date"
          >
            <header>
              <button
                aria-label="Previous month"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
              >
                <AppIcon name="chevron_left" size={22} />
              </button>
              <h2>
                {viewDate.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <button
                aria-label="Next month"
                disabled={localDateKey(new Date(year, month + 1, 1)) > today}
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
              >
                <AppIcon name="chevron_right" size={22} />
              </button>
            </header>
            <div className="onboarding-calendar-grid">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <small key={d}>{d}</small>
              ))}
              {Array.from({ length: first }, (_, i) => (
                <span key={`empty${i}`} />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const date = new Date(year, month, i + 1),
                  key = localDateKey(date),
                  selected =
                    !!lastPeriodDate && localDateKey(lastPeriodDate) === key;
                return (
                  <button
                    key={key}
                    aria-label={key}
                    aria-pressed={selected}
                    disabled={key > today}
                    onClick={() => {
                      setLastPeriodDate(date);
                      setSaveError("");
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </section>
        )}
        {step === 2 && (
          <CycleDial
            label="Cycle length"
            value={cycleLength}
            min={20}
            max={45}
            onChange={setCycleLength}
          />
        )}
        {step === 3 && (
          <CycleDial
            label="Period length"
            value={periodLength}
            min={2}
            max={10}
            onChange={setPeriodLength}
          />
        )}
        {saveError && (
          <p className="onboarding-error" role="alert">
            {saveError}
          </p>
        )}
        <button
          className="reference-button onboarding-continue"
          disabled={loading || (step === 1 && !lastPeriodDate)}
          onClick={() => (step === 3 ? void finish() : setStep((s) => s + 1))}
        >
          {loading
            ? "Saving your rhythm…"
            : step === 0
              ? "Let's Start"
              : step === 3
                ? "Finish Setup"
                : "Continue"}
          <AppIcon
            name={loading ? "progress_activity" : "arrow_forward"}
            size={23}
          />
        </button>
        <div
          className="onboarding-progress"
          aria-label={step === 0 ? "Getting started" : `Step ${step} of 3`}
        >
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={n <= Math.max(1, step) ? "is-complete" : ""}
            />
          ))}
          <p>
            {step === 0 ? "A little more in tune with you" : `${step} of 3`}
          </p>
        </div>
      </motion.div>
    </main>
  );
}
