export const vaultContractName = "Vault";
export const vaultEventNames = ["Deposit", "Withdraw"] as const;
export const vaultAbi = [] as const;

export type VaultAbi = typeof vaultAbi;
export type VaultEventName = (typeof vaultEventNames)[number];
