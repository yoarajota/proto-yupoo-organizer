export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-border flex items-center px-4">
      <span className="font-semibold text-foreground">Yupoo Organizer</span>
      <div className="ml-auto" aria-label="User actions" />
    </header>
  );
}
