const STEPS = [
  { step: 1, label: "Driver Info" },
  { step: 2, label: "Review" },
  { step: 3, label: "Agreement" },
];

export default function StepProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 mb-8 max-w-md">
      {STEPS.map((s, i) => (
        <div key={s.step} className="flex items-center gap-2 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                s.step <= current ? "bg-black text-white" : "bg-gray-100 text-gray-400"
              }`}
            >
              {s.step}
            </span>
            <span className={`text-xs whitespace-nowrap ${s.step <= current ? "text-gray-900 font-medium" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 ${s.step < current ? "bg-black" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
