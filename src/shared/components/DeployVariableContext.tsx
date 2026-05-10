import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import camelCase from 'camelcase';
import { ModuleExample } from '../../types/Module';

interface VariableContextProps {
  variables: { [key: string]: any };
  setVariable: (name: string, value: any) => void;
  resetVariables: () => void;
  hasInvalidVariables: boolean;
  setHasInvalidVariables: (value: boolean) => void;
}

const VariableContext = createContext<VariableContextProps | undefined>(undefined);

export const VariableProvider = ({
  children,
  example,
}: {
  children: ReactNode;
  example: ModuleExample;
}) => {
  const [variables, setVariables] = useState<{ [key: string]: any }>({});
  const [hasInvalidVariables, setHasInvalidVariables] = useState(false);

  useEffect(() => {
    const initialVariables: { [key: string]: any } = {};
    Object.entries(example.variables).forEach(([key, value]) => {
      initialVariables[camelCase(key)] = value;
    });
    setVariables(initialVariables);
  }, [example]);

  const setVariable = (name: string, value: any) => {
    const camelCasedName = camelCase(name);
    setVariables((prev) => ({ ...prev, [camelCasedName]: value }));
  };

  const resetVariables = () => {
    const resetVars: { [key: string]: any } = {};
    Object.entries(example.variables).forEach(([key, value]) => {
      resetVars[camelCase(key)] = value;
    });
    setVariables(resetVars);
    setHasInvalidVariables(false);
  };

  return (
    <VariableContext.Provider
      value={{
        variables,
        setVariable,
        resetVariables,
        hasInvalidVariables,
        setHasInvalidVariables,
      }}
    >
      {children}
    </VariableContext.Provider>
  );
};

export const useVariables = () => {
  const context = useContext(VariableContext);
  if (!context) {
    throw new Error('useVariables must be used within a VariableProvider');
  }
  return context;
};
