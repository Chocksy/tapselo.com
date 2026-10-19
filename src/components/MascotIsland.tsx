// Cursor-following site mascot (rendered inside SiteMascot.astro).
// Built on page-mascot (MIT © Kamran Ahmed, https://github.com/nilbuild/page-mascot);
// see THIRD_PARTY_NOTICES.md.
// Rendered with Preact: page-mascot's `react` imports resolve to preact/compat
// (preact({ compat: true }) in astro.config.mjs).
import { useEffect, useRef, useState } from "preact/hooks";
import { Mascot } from "page-mascot";

type Props = {
  directions: string;
  reactions: string;
  size: number;
  label: string;
};

export default function MascotIsland({ directions, reactions, size, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  // The server render (and any visitor the island never hydrates for, e.g.
  // prefers-reduced-motion) gets one static, decorative frame.
  useEffect(() => setLive(true), []);

  // page-mascot prefixes its label with English ("Boop the …"); keep it Romanian.
  useEffect(() => {
    box.current?.querySelector("button")?.setAttribute("aria-label", label);
  }, [live, label]);

  if (!live) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: size,
          height: size,
          backgroundImage: `url(${directions})`,
          backgroundSize: "300% 300%",
          backgroundPosition: "50% 50%",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }

  return (
    <div ref={box}>
      <Mascot directions={directions} reactions={reactions} size={size} label={label} />
    </div>
  );
}
