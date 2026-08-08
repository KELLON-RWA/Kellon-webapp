"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  securityService,
  type OtpChannel,
  type SecuritySettings,
} from "@/services/api/security";
import type {
  DisableSecurityAction,
  IntegrationModal,
  SecuritySetup,
} from "./security-types";

const EMPTY_SETTINGS: SecuritySettings = {
  biometricsEnabled: false,
  totpEnabled: false,
  emailOtpEnabled: false,
  smsOtpEnabled: false,
};

export function useSecuritySettings() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [integrationModal, setIntegrationModal] =
    useState<IntegrationModal>(null);
  const [setup, setSetup] = useState<SecuritySetup>(null);
  const [disableAction, setDisableAction] =
    useState<DisableSecurityAction>(null);
  const mountedRef = useRef(true);

  const loadSettings = useCallback(async () => {
    try {
      const nextSettings = await securityService.getSettings();
      if (mountedRef.current) setSettings(nextSettings);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load security settings",
      );
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadSettings();
    return () => {
      mountedRef.current = false;
    };
  }, [loadSettings]);

  const beginOtpSetup = async (channel: OtpChannel) => {
    setActiveAction(channel);
    try {
      const response = await securityService.requestOtp(channel);
      setSetup({
        kind: "otp",
        channel,
        destination: response.data.maskedDestination,
      });
      toast.success(
        `Verification code sent by ${channel === "sms" ? "SMS" : "email"}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to send code",
      );
    } finally {
      setActiveAction(null);
    }
  };

  const beginTotpSetup = async () => {
    setActiveAction("totp");
    try {
      const response = await securityService.setupTotp();
      setSetup({
        kind: "totp",
        secret: response.data.secret,
        qrCodeUrl: response.data.qrCodeUrl,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to set up Google Authenticator",
      );
    } finally {
      setActiveAction(null);
    }
  };

  const toggleBiometrics = async (enabled: boolean) => {
    setActiveAction("biometrics");
    try {
      await securityService.toggleBiometrics(enabled);
      setSettings((current) => ({ ...current, biometricsEnabled: enabled }));
      toast.success(
        `Biometric confirmation ${enabled ? "enabled" : "disabled"}.`,
      );
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update biometrics",
      );
      return false;
    } finally {
      setActiveAction(null);
    }
  };

  const changeOtp = (channel: OtpChannel, enabled: boolean) => {
    if (enabled) {
      void beginOtpSetup(channel);
      return;
    }
    setDisableAction({
      kind: "otp",
      channel,
      label: channel === "email" ? "Email verification" : "SMS verification",
    });
  };

  const changeTotp = (enabled: boolean) => {
    if (enabled) {
      void beginTotpSetup();
      return;
    }
    setDisableAction({ kind: "totp", label: "Google Authenticator" });
  };

  const changeBiometrics = (enabled: boolean) => {
    if (enabled) {
      void toggleBiometrics(true);
      return;
    }
    setDisableAction({
      kind: "biometrics",
      label: "Biometric confirmation",
    });
  };

  const disableOtp = async (channel: OtpChannel) => {
    setActiveAction(channel);
    try {
      await securityService.disableOtp(channel);
      setSettings((current) => ({
        ...current,
        [channel === "email" ? "emailOtpEnabled" : "smsOtpEnabled"]: false,
      }));
      toast.success(
        `${channel === "email" ? "Email" : "SMS"} verification disabled.`,
      );
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update verification",
      );
      return false;
    } finally {
      setActiveAction(null);
    }
  };

  const disableTotp = async () => {
    setActiveAction("totp");
    try {
      await securityService.disableTotp();
      setSettings((current) => ({ ...current, totpEnabled: false }));
      toast.success("Google Authenticator disabled.");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to disable Google Authenticator",
      );
      return false;
    } finally {
      setActiveAction(null);
    }
  };

  const confirmDisable = async () => {
    if (!disableAction || activeAction) return;

    let disabled = false;
    if (disableAction.kind === "otp") {
      disabled = await disableOtp(disableAction.channel);
    } else if (disableAction.kind === "totp") {
      disabled = await disableTotp();
    } else {
      disabled = await toggleBiometrics(false);
    }

    if (disabled && mountedRef.current) setDisableAction(null);
  };

  const submitSetup = async (code: string) => {
    const verificationCode = code.trim();
    if (!setup || verificationCode.length < 4 || activeAction) return;
    setActiveAction("setup");
    try {
      if (setup.kind === "otp") {
        await securityService.enableOtp(setup.channel, verificationCode);
        setSettings((current) => ({
          ...current,
          [setup.channel === "email" ? "emailOtpEnabled" : "smsOtpEnabled"]:
            true,
        }));
      } else {
        await securityService.enableTotp(verificationCode);
        setSettings((current) => ({ ...current, totpEnabled: true }));
      }
      toast.success("Security method enabled.");
      setSetup(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invalid verification code",
      );
    } finally {
      setActiveAction(null);
    }
  };

  return {
    settings,
    isLoading,
    isBusy: activeAction !== null,
    isSubmittingSetup: activeAction === "setup",
    integrationModal,
    setup,
    disableAction,
    changeOtp,
    changeTotp,
    changeBiometrics,
    setIntegrationModal,
    closeSetup: () => !activeAction && setSetup(null),
    closeDisable: () => !activeAction && setDisableAction(null),
    confirmDisable,
    submitSetup,
  };
}
