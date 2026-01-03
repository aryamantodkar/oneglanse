export const SentimentMetricCell = ({ sentiment }: { sentiment: number | string }) => {
    if (sentiment === "-" || sentiment === undefined) {
      return <div className="text-gray-400 text-sm">-</div>;
    }
  
    const num = Number(sentiment);
    let bgClass = "";
    let dotClass = "";
  
    if (num >= 70) {
      bgClass = "bg-emerald-50 text-emerald-700";
      dotClass = "bg-emerald-500";
    } else if (num >= 40) {
      bgClass = "bg-amber-50 text-amber-700";
      dotClass = "bg-amber-500";
    } else {
      bgClass = "bg-rose-50 text-rose-700";
      dotClass = "bg-rose-500";
    }
  
    return (
      <div
        className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-sm font-medium ${bgClass}`}
      >
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        {num}
      </div>
    );
};