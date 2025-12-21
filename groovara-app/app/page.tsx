export default function Home() {
  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-6">
        <h1 className="text-sm tracking-[0.35em] font-medium text-purple-300">
          GROOVARA
        </h1>
        <nav className="space-x-8 text-xs tracking-widest text-gray-400">
          <a href="#" className="hover:text-purple-300 transition">HOME</a>
          <a href="#" className="hover:text-purple-300 transition">LIST</a>
        </nav>
      </header>

      {/* Hero */}
      <section
        className="relative h-[65vh] bg-cover bg-center"
        style={{
          backgroundImage: "url('/GV_HomepageImage.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 flex h-full items-center justify-center">
          <div className="text-center px-6">
            <p className="mb-6 text-xs tracking-[0.4em] text-purple-400">
              NOT A MIXTAPE. NOT A PLAYLIST.
            </p>
            <h2 className="text-2xl md:text-3xl font-light tracking-wide text-gray-100">
              Something new is coming.
            </h2>
          </div>
        </div>
      </section>

      {/* Message */}
      <section className="py-20 text-center px-6">
        <p className="text-lg font-light tracking-wide text-gray-300 mb-6">
          A fresh way to share the meanings inside your music.
        </p>
        <p className="text-sm tracking-widest text-purple-300">
          SIMPLE. PERSONAL. UNFORGETTABLE.
        </p>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-xs tracking-widest text-gray-500">
        © {new Date().getFullYear()} GROOVARA
      </footer>
    </main>
  );
}
