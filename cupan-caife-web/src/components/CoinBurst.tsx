type CoinBurstProps = {
  open: boolean;
  coins: number;
  label: string;
};

export default function CoinBurst({ open, coins, label }: CoinBurstProps) {
  if (!open) return null;

  return (
    <div className="coin-burst" role="status" aria-live="polite">
      <div className="coin-icon">☘️</div>
      <div className="coin-pill">+{coins} CraicCoins</div>
      <div className="coin-label">{label}</div>
    </div>
  );
}
