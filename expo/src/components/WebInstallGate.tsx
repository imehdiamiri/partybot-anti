import React, { PropsWithChildren } from 'react';
// Native apps are already installed.
export type WebInstallGateProps = PropsWithChildren<{ onboardingComplete: boolean; settingsReady: boolean }>;
export function WebInstallGate({ children }: WebInstallGateProps) { return <>{children}</>; }
