import React, { createContext, useContext, useState } from 'react';
import { ArchitectureInfo } from '../components/ArchitectureOverlay';

interface ArchitectureContextType {
  isOpen: boolean;
  currentInfo: ArchitectureInfo | null;
  openArchitecture: (info: ArchitectureInfo) => void;
  closeArchitecture: () => void;
  toggleArchitecture: () => void;
}

const ArchitectureContext = createContext<ArchitectureContextType | undefined>(
  undefined
);

export const ArchitectureProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentInfo, setCurrentInfo] = useState<ArchitectureInfo | null>(null);

  const openArchitecture = (info: ArchitectureInfo) => {
    setCurrentInfo(info);
    setIsOpen(true);
  };

  const closeArchitecture = () => {
    setIsOpen(false);
  };

  const toggleArchitecture = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <ArchitectureContext.Provider
      value={{
        isOpen,
        currentInfo,
        openArchitecture,
        closeArchitecture,
        toggleArchitecture,
      }}
    >
      {children}
    </ArchitectureContext.Provider>
  );
};

export const useArchitecture = () => {
  const context = useContext(ArchitectureContext);
  if (context === undefined) {
    throw new Error('useArchitecture must be used within an ArchitectureProvider');
  }
  return context;
};
