export const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
  
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
  
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
  
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert 0 → 12
  
    return `${day}/${month}/${year} · ${hours}:${minutes} ${ampm}`;
};