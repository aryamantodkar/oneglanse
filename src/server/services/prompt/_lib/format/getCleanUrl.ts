export const getCleanUrl = (url: string) => {
    try {
      const u = new URL(url);
      u.searchParams.delete("utm_source"); // remove utm_source
      u.searchParams.delete("utm_medium"); // optional: remove other tracking params
      u.searchParams.delete("utm_campaign");
      return u.toString();
    } catch {
      return url; // return as-is if invalid
    }
};