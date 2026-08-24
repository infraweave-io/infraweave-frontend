import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Context to hold selected cloud providers
interface SelectedProvidersContextProps {
  selectedProviders: string[];
  toggleProviderSelection: (provider: string) => void;
  availableProviders: string[]; // Available providers to choose from
}

const SelectedProvidersContext = createContext<SelectedProvidersContextProps | undefined>(
  undefined,
);

export const SelectedProvidersProvider = ({
  children,
  initialProviders,
}: {
  children: ReactNode;
  initialProviders?: string[];
}) => {
  // Hardcoded for now. Azure and GCP are kept here, commented out, so they can
  // be switched back on when those clouds are actually supported.
  const availableProviders = ['AWS' /* , 'Azure', 'GCP' */];

  const [selectedProviders, setSelectedProviders] = useState<string[]>(() => {
    if (initialProviders) return initialProviders;
    // Load from localStorage on initial load
    const savedProviders = localStorage.getItem('selectedProviders');
    const saved: string[] = savedProviders ? JSON.parse(savedProviders) : [];

    // Drop anything no longer offered. Each selected provider triggers its own
    // fetch in Projects/Policies, so a leftover 'azure' from a previous session
    // would duplicate every row -- with no checkbox left to clear it.
    return saved.filter((provider) =>
      availableProviders.some((available) => available.toLowerCase() === provider.toLowerCase()),
    );
  });

  // Update localStorage whenever selectedProviders changes
  useEffect(() => {
    localStorage.setItem('selectedProviders', JSON.stringify(selectedProviders));
  }, [selectedProviders]);

  const toggleProviderSelection = (provider: string) => {
    setSelectedProviders((prevProviders) => {
      return prevProviders.includes(provider)
        ? prevProviders.filter((name) => name !== provider)
        : [...prevProviders, provider];
    });
  };

  return (
    <SelectedProvidersContext.Provider
      value={{
        selectedProviders,
        toggleProviderSelection,
        availableProviders,
      }}
    >
      {children}
    </SelectedProvidersContext.Provider>
  );
};

// Hook to use selected providers context
export const useSelectedProviders = () => {
  const context = useContext(SelectedProvidersContext);
  if (!context) {
    throw new Error('useSelectedProviders must be used within a SelectedProvidersProvider');
  }
  return context;
};
