import { FC, Fragment, ReactNode } from "react";

import { ThemeProvider } from "./theme-provider";

import { CustomWagmiProvider } from "./wagmi-provider";
import React from "react";
import ReactQueryProvider from "./ReactQueryProvider";
import MyPrivyProvider from "./PrivyProvider";
import RealtimeProvider from "./RealtimeProvider";
import { Toaster } from "sonner";

interface ProviderProps {
  children: ReactNode;
}

const Provider: FC<ProviderProps> = async ({ children }) => {
  return (
    <Fragment>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={true}
        storageKey="kellon-theme"
      >
        <MyPrivyProvider>
          <ReactQueryProvider>
            <RealtimeProvider>
              <CustomWagmiProvider>
                <div className="font-manrope text-cryptoNight dark:text-white relative min-h-screen">
                  {/* Enhanced Glass Texture */}
                  <div className="fixed inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-white1 via-gray-90 to-violet1/10 dark:from-violet1/10 dark:via-secondary-50 dark:to-secondary-40" />
                    <div className="absolute inset-0 backdrop-blur-xl" />
                    <div className="absolute inset-0 bg-white/5 dark:bg-black/10" />
                  </div>

                  <div className="relative z-10">{children}</div>
                  <Toaster richColors position="top-center" theme="system" />
                </div>
              </CustomWagmiProvider>
            </RealtimeProvider>
          </ReactQueryProvider>
        </MyPrivyProvider>
      </ThemeProvider>
    </Fragment>
  );
};
export default Provider;
