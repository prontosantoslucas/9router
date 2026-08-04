import { useConfig } from "../store.js";

export default function PeriodToggle() {
  const { period, setPeriod } = useConfig();
  return (
    <div className="period">
      <button className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>
        Diário
      </button>
      <button className={period === "7d" ? "active" : ""} onClick={() => setPeriod("7d")}>
        Semanal
      </button>
    </div>
  );
}
