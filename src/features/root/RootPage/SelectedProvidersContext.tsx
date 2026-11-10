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

/**
 * The filter panel works in lowercase throughout — the checkbox `name`, the
 * `checked` test and the toggle argument are all lowercased — so the state has to
 * as well. A stored or default `'AWS'` matched no checkbox, and toggling it then
 * appended `'aws'` alongside, which made Projects and Policies fetch (and render)
 * every row twice. Deduplicated for the same reason.
 */
const normalizeProviders = (providers: string[]): string[] =>
  Array.from(new Set(providers.map((provider) => provider.toLowerCase())));

export const SelectedProvidersProvider = ({
  children,
  initialProviders,
}: {
  children: ReactNode;
  initialProviders?: string[];
}) => {
  const inheritedContext = useContext(SelectedProvidersContext);
  // This is mounted at the app root and again inside `RootPage`, which renders
  // under that root. Two providers would hold independent state, so a toggle in
  // one subtree would never reach consumers of the other — and the inner one
  // remounts on every navigation, re-running the initializer and silently
  // re-ticking every cloud, losing a deliberately empty selection. Defer to
  // whichever provider is already above us.
  if (inheritedContext && !initialProviders) {
    return <>{children}</>;
  }

  return (
    <SelectedProvidersRoot initialProviders={initialProviders}>{children}</SelectedProvidersRoot>
  );
};

const SelectedProvidersRoot = ({
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
    if (initialProviders) return normalizeProviders(initialProviders);
    // Load from localStorage on initial load
    const savedProviders = localStorage.getItem('selectedProviders');
    const saved: string[] = savedProviders ? JSON.parse(savedProviders) : [];

    // Drop anything no longer offered. Each selected provider triggers its own
    // fetch in Projects/Policies, so a leftover 'azure' from a previous session
    // would duplicate every row -- with no checkbox left to clear it.
    const offered = normalizeProviders(availableProviders);
    const filtered = normalizeProviders(saved).filter((provider) => offered.includes(provider));

    // An empty selection now hides the module, stack and provider lists, so it
    // can't be the starting state: a first visit would show empty tables and a
    // filter the user never touched. Nothing stored, or nothing left after
    // dropping unsupported clouds, therefore means "not chosen yet" and starts
    // inclusive. Note this is also the upgrade path -- the previous version
    // persisted `[]` for everyone who never ticked a box, and reading that back
    // literally would blank the lists out for them.
    //
    // The consequence is that unticking every cloud empties the lists for the
    // rest of the session but does not survive a reload, which is the right way
    // round: an all-empty filter is not a state worth remembering.
    return filtered.length > 0 ? filtered : offered;
  });

  // Update localStorage whenever selectedProviders changes
  useEffect(() => {
    localStorage.setItem('selectedProviders', JSON.stringify(selectedProviders));
  }, [selectedProviders]);

  const toggleProviderSelection = (provider: string) => {
    // Normalized here too, so a caller passing 'AWS' can't append a second entry
    // for a cloud that is already selected.
    const name = provider.toLowerCase();
    setSelectedProviders((prevProviders) => {
      return prevProviders.includes(name)
        ? prevProviders.filter((selected) => selected !== name)
        : [...prevProviders, name];
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
