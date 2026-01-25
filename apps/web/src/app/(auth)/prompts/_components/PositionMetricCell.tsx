export const PositionMetricCell = ({ position }: { position: number | string }) => {
    if (position === "-" || position === undefined) {
      return <span className="text-gray-400 text-sm">-</span>;
    }
  
    const num = Number(position);
    const color =
      num <= 3
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  
    return (
      <div
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${color}`}
      >
        {num}
      </div>
    );
};