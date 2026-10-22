// Draws a few places in the token style through the studio's server, one after another.
const wanted = ["Charles Bridge", "Klausen Synagogue", "Kampa Island", "St. Vitus Cathedral"];
const defaults = await (await fetch("http://localhost:3051/api/defaults")).json();
const places = await (
  await fetch("http://localhost:3051/api/places?lat=50.0865&lon=14.4114")
).json();
for (const name of wanted) {
  const place = places.find((p: { name: string }) => p.name === name);
  if (!place) {
    console.log("missing", name);
    continue;
  }
  const spec = {
    version: defaults.version,
    style: defaults.styles.token,
    subject: {
      name: place.name,
      city: "Prague",
      what: place.description,
      kind: place.kind,
      ...defaults.kinds[place.kind],
      reference: place.imageUrl
        ? { url: place.imageUrl, license: place.imageLicense, use: defaults.referenceUse }
        : null,
    },
    render: { model: "qwen-image-2.1-turbo", size: 1024, steps: null, guidance: null, seed: null },
  };
  const t = Date.now();
  const r = await fetch("http://localhost:3051/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec }),
  });
  const meta = await r.json();
  console.log(
    name,
    r.status,
    meta.id ?? meta.error,
    `${Math.round((Date.now() - t) / 1000)}s`,
    meta.width ? `${meta.width}x${meta.height}` : "",
  );
}
