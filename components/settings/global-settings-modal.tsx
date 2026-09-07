"use client";

import React from "react";
import { useUIState } from "@/components/providers/ui-state-provider";
import { SettingsModal } from "@/components/settings/settings-modal";

export function GlobalSettingsModal() {
  const { isProfileModalOpen, profileModalTab, closeProfileModal } = useUIState();

  return (
    <SettingsModal
      isOpen={isProfileModalOpen}
      initialTab={profileModalTab}
      onClose={closeProfileModal}
    />
  );
}
