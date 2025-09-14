export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold mb-6">🚀 Welcome to T3 App</h1>
        <p className="text-lg text-gray-600 mb-4">
          You’re running Next.js with Tailwind CSS, tRPC, and Drizzle.
        </p>
        <button className="rounded-lg bg-black px-6 py-3 text-white font-medium shadow hover:bg-gray-800 transition">
          Get Started
        </button>
      </div>
    </main>
  );
}