import { createContext, useContext, useEffect, useState } from 'react';

interface RuntimeConfig {
  uid?: string;
  telemetry?: 'on' | 'off';
}

const RuntimeConfigContext = createContext<RuntimeConfig>({});

const useRuntimeConfigContext = () => {
  return useContext(RuntimeConfigContext);
};

const RuntimeConfigProvider = ({ children }: { children: any }) => {
  const [runtimeConfig, setRuntimeConfig] = useState({} as RuntimeConfig);
  useEffect(() => {
    if (!!global.window) {
      const execute = async () => {
        try {
          const response = await fetch(`${window.location.origin}/api/runtime-config`);
          if (response.status === 200) {
            const configJson = await response.json();
            if (!Object.keys(runtimeConfig).length) {
              setRuntimeConfig(configJson);
            }
          }
        } catch {}
      };
      execute();
    }
  }, [runtimeConfig]);
  return <RuntimeConfigContext.Provider value={runtimeConfig}>{children}</RuntimeConfigContext.Provider>;
};

export { RuntimeConfigProvider, useRuntimeConfigContext };
