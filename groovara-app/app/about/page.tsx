export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0b0a0f] text-gray-200 flex items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="mb-6 text-2xl font-light tracking-wide text-gray-100">
          About Groovara
        </h1>

        <p className="mb-6 text-base font-light leading-relaxed text-gray-300">
          Groovara is a creative music platform designed for expression, not
          consumption. While streaming services organize songs, Groovara
          organizes intention. It helps people turn music into meaningful
          listening experiences — for reflection, storytelling, and human
          connection.
        </p>

        <p className="text-base font-light leading-relaxed text-gray-300">
          Groovara works alongside existing streaming platforms, using links to
          shape music into emotionally guided experiences rather than passive
          playlists.
        </p>
      </div>
    </main>
  );
}
