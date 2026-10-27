import fs from "node:fs/promises";
import ts from "typescript";
const source = await fs.readFile(
  new URL("../lib/exercises.ts", import.meta.url),
  "utf8",
);
const js = ts
  .transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  })
  .outputText.replace(
    "'./dates'",
    JSON.stringify(new URL("../lib/dates.ts", import.meta.url).href),
  );
const { exercises, seatedPose, standingPose } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char],
  );
const line = (a, b, color, width) =>
  `<path d="M${a}L${b}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
function figure(p, chair, id, final = false) {
  const skin = "#efb39e",
    pants = "#8e80b4",
    shoe = "#5e567d",
    hair = "#5f4053";
  const mid = [(p.SL[0] + p.SR[0]) / 2, (p.SL[1] + p.SR[1]) / 2];
  const neckBase = [mid[0], mid[1] + 2];
  const tilt = final && id === "neck-tilt" ? -14 : 0;
  const rotate = ([x, y]) => {
    const a = (tilt * Math.PI) / 180,
      dx = x - neckBase[0],
      dy = y - neckBase[1];
    return [
      neckBase[0] + dx * Math.cos(a) - dy * Math.sin(a),
      neckBase[1] + dx * Math.sin(a) + dy * Math.cos(a),
    ];
  };
  const headContact = rotate([p.H[0], p.H[1] + 13]);
  // Each limb terminates inside its next part; round joins keep the body
  // continuous at every pose, including raised arms and lifted heels.
  const feet = ["L", "R"]
    .map((side) => {
      const [x, y] = p["F" + side],
        direction = side === "L" ? -1 : 1;
      const angle =
        final && ["ankle-pump", "seated-toes", "standing-toes"].includes(id)
          ? -direction * 13
          : 0;
      return `<g data-part="shoe-${side}" transform="translate(${x} ${y}) rotate(${angle}) scale(${direction} 1)">${line([0, -9], [0, 0], skin, 10)}<path d="M-7-5Q0-8 7-5L15 0Q18 5 11 7H-7Q-11 5-10 1Z" fill="${shoe}"/><path d="M-7 5H12" stroke="${shoe}" stroke-width="3" stroke-linecap="round"/><path d="m-1-3 4 1m-3 2 4 1" stroke="#fff6fa" stroke-width="1.2" stroke-linecap="round" opacity=".65"/></g>`;
    })
    .join("");
  const legs = ["L", "R"]
    .map(
      (side) =>
        `<g data-part="leg-${side}">${line(p["P" + side], p["K" + side], pants, 18) + line(p["K" + side], p["F" + side], pants, 16)}</g>`,
    )
    .join("");
  const hands = ["L", "R"]
    .map((side) => {
      const wrist = p["W" + side],
        elbow = p["E" + side];
      const angle =
        (Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]) * 180) / Math.PI -
        90;
      const spread = final && id === "finger-spread",
        closed = final && id === "hand-close";
      const fingers = spread
        ? Array.from({ length: 4 }, (_, i) =>
            line(
              [-4 + i * 2.7, 6],
              [-9 + i * 6, 15 - (i === 0 || i === 3 ? 2 : 0)],
              skin,
              2.8,
            ),
          ).join("")
        : closed
          ? '<path d="M-4 6H4m-6 3h4" fill="none" stroke="#cd907d" stroke-width="1"/>'
          : Array.from({ length: 3 }, (_, i) =>
              line(
                [-3 + i * 3, 5],
                [-3 + i * 3, 10 - Math.abs(i - 1)],
                skin,
                2.8,
              ),
            ).join("");
      return `<g data-part="hand-${side}" transform="translate(${wrist}) rotate(${angle}) scale(${side === "L" ? -1 : 1} 1)"><path d="M-4-3Q-6 1-5 6Q-4 10 0 10Q5 10 5 5L4-3Z" fill="${skin}"/>${line([-4, 1], [-7, 5], skin, 3.4)}${fingers}</g>`;
    })
    .join("");
  const arms = ["L", "R"]
    .map(
      (side) =>
        `<g data-part="arm-${side}">${line(p["S" + side], p["E" + side], skin, 12) + line(p["E" + side], p["W" + side], skin, 11)}</g>`,
    )
    .join("");
  const wall = ["wall-press", "wall-chest", "calf-stretch"].includes(id)
    ? '<path d="M192 55V220" stroke="#d5c5d2" stroke-width="6"/>'
    : "";
  const support = [
    "standing-heels",
    "standing-toes",
    "supported-knee",
    "side-leg",
    "heel-curl",
    "mini-bend",
    "split-stance",
  ].includes(id)
    ? '<path d="M164 128H180M177 128V218" fill="none" stroke="#c5b5a6" stroke-width="6" stroke-linecap="round"/>'
    : "";
  const seat =
    wall +
    support +
    (chair
      ? '<path d="M76 145H164M82 145V218M158 145V218M77 145V100" fill="none" stroke="#c5b5a6" stroke-width="7" stroke-linecap="round"/>'
      : "");
  const headX = p.H[0],
    headY = p.H[1];
  const profile = final && id === "neck-turn";
  const face = profile
    ? `<path d="M${headX + 5} ${headY + 1}h2m2 3 5 1-5 2m-4 4h6" fill="none" stroke="#6d4857" stroke-width="1.8" stroke-linecap="round"/>`
    : `<path d="M${headX - 7} ${headY + 2}h2m9 0h2m-10 7q4 3 8 0" fill="none" stroke="#6d4857" stroke-width="1.8" stroke-linecap="round"/>`;
  const head = `<g data-part="head" transform="rotate(${tilt} ${neckBase})"><path d="M${headX - 16} ${headY + 6}Q${headX - 24} ${headY - 28} ${headX} ${headY - 24}Q${headX + 25} ${headY - 25} ${headX + 18} ${headY + 11}" fill="${hair}"/><circle cx="${headX}" cy="${headY}" r="17" fill="${skin}"/><path d="M${headX - 17} ${headY - 7}Q${headX - 2} ${headY - 24} ${headX + 16} ${headY - 7}" fill="${hair}"/>${face}</g>`;
  return `${seat}${legs}${feet}<path data-part="neck" d="M${neckBase}L${headContact}" stroke="${skin}" stroke-width="13" stroke-linecap="round"/><path data-part="shirt" d="M${p.SL}Q${mid[0]} ${mid[1] - 10} ${p.SR}L${p.PR}Q${mid[0]} ${Math.max(p.PL[1], p.PR[1]) + 9} ${p.PL}Z" fill="#dc829f"/>${arms}${hands}${head}`;
}

await fs.mkdir(new URL("../public/art/exercise/", import.meta.url), {
  recursive: true,
});
for (const exercise of exercises) {
  const chair =
    exercise.category === "Seated" ||
    exercise.id === "seated-breathe" ||
    exercise.id === "shoulder-breathe" ||
    exercise.id === "sit-stand";
  const start = chair ? seatedPose : standingPose,
    end =
      exercise.id === "sit-stand"
        ? standingPose
        : { ...start, ...exercise.changes };
  const candidates = ["Neck", "Posture"].includes(exercise.focus)
    ? ["H"]
    : ["Ankles", "Calves"].includes(exercise.focus)
      ? ["FL", "FR"]
      : ["Legs", "Hips", "Movement"].includes(exercise.focus)
        ? ["KL", "KR", "FL", "FR"]
        : ["WL", "WR", "EL", "ER", "SL", "SR"];
  const changed = candidates.find((key) => exercise.changes[key]);
  const target =
    exercise.focus === "Breath" ? [120, 110] : end[changed || candidates[0]];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260"><title>${escape(exercise.name)}: start and comfortable range</title><rect x="1" y="1" width="418" height="258" rx="28" fill="#fff6fa"/><path d="M20 227H397" stroke="#ecd9e4" stroke-width="2"/><g transform="translate(12 30) scale(.78)">${figure(start, chair, exercise.id)}</g><g transform="translate(220 30) scale(.78)">${figure(end, chair, exercise.id, true)}<circle cx="${target[0]}" cy="${target[1]}" r="23" fill="none" stroke="#bc567f" stroke-width="1.8" stroke-dasharray="4 5"/></g><path d="M193 117h28m-8-8 9 8-9 8" stroke="#b5688e" stroke-width="3" fill="none" stroke-linecap="round"/><text x="103" y="248" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#675571">Start</text><text x="311" y="248" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#675571">Easy range</text></svg>`;
  await fs.writeFile(new URL(`../public${exercise.art}`, import.meta.url), svg);
  const palette = {
    "#fff6fa": "#281e32",
    "#ecd9e4": "#4c3756",
    "#675571": "#d7c8e4",
    "#8e80b4": "#a99bc6",
    "#5e567d": "#c7b9de",
    "#dc829f": "#bd638f",
    "#c5b5a6": "#88788b",
    "#d5c5d2": "#705977",
    "#bc567f": "#e79ab9",
    "#b5688e": "#e0a4c1",
  };
  const dark = svg.replace(/#[a-f0-9]{6}/g, (color) => palette[color] || color);
  await fs.writeFile(
    new URL(
      `../public${exercise.art.replace(".svg", ".dark.svg")}`,
      import.meta.url,
    ),
    dark,
  );
}
console.log(
  `Generated ${exercises.length} original two-pose SVG exercise sets with paired light/dark artwork.`,
);
