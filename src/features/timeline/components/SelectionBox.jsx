export function SelectionBox({ x, y, w, h, labelWidth }) {
  return (
    <div
      className="absolute border border-primary bg-primary/20 pointer-events-none z-50 mix-blend-screen"
      style={{
        left: x + labelWidth, top: y,
        width: w, height: h
      }}
    />
  );
}
