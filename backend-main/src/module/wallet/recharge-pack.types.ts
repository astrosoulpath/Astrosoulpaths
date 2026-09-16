export interface RechargePackResponse {
  id: string;
  amount: number;
  bonusPercent: number;
  bonusAmount: number;
  creditAmount: number;
  label: string | null;
}
