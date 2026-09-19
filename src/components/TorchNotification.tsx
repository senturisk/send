import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { TorchNotificationItem } from "../types";
import { SolarIcon } from "../lib/icons";

interface TorchNotificationProps {
  notifications: TorchNotificationItem[];
  onDismiss: (id: string) => void;
}

export const TorchNotificationContainer: React.FC<TorchNotificationProps> = ({
  notifications,
  onDismiss,
}) => {
  return (
    <div
      id="torch-notifications-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((notif) => {
          let beamGlow = "from-blue-500/30 to-transparent";
          let iconName = "info-circle-bold-duotone";
          let iconColor = "text-blue-600";
          let dotColor = "bg-blue-500";

          if (notif.type === "error") {
            beamGlow = "from-rose-500/30 to-transparent";
            iconName = "danger-triangle-bold-duotone";
            iconColor = "text-rose-600";
            dotColor = "bg-rose-500";
          } else if (notif.type === "warning") {
            beamGlow = "from-amber-500/30 to-transparent";
            iconName = "shield-warning-bold-duotone";
            iconColor = "text-amber-600";
            dotColor = "bg-amber-500";
          } else if (notif.type === "success") {
            beamGlow = "from-emerald-500/30 to-transparent";
            iconName = "check-circle-bold-duotone";
            iconColor = "text-emerald-600";
            dotColor = "bg-emerald-500";
          } else if (notif.type === "peer-join") {
            beamGlow = "from-indigo-500/30 to-transparent";
            iconName = "user-plus-bold-duotone";
            iconColor = "text-indigo-600";
            dotColor = "bg-indigo-500";
          } else if (notif.type === "peer-leave") {
            beamGlow = "from-slate-400/30 to-transparent";
            iconName = "user-cross-bold-duotone";
            iconColor = "text-slate-500";
            dotColor = "bg-slate-400";
          }

          return (
            <motion.div
              key={notif.id}
              id={`torch-notification-${notif.id}`}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-lg shadow-slate-200/60 p-3 pointer-events-auto flex items-start gap-3"
            >
              {/* Subtle Radiant Torch Beam along the edge */}
              <div
                className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${beamGlow}`}
              />
              <div
                className={`absolute top-0 left-0 w-16 h-full bg-gradient-to-r ${beamGlow} opacity-30 pointer-events-none`}
              />

              <div className="pt-0.5 shrink-0 pl-1">
                <SolarIcon name={iconName} className={`w-5 h-5 ${iconColor}`} />
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <h4 className="text-xs font-semibold text-slate-800 truncate">
                    {notif.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-normal break-words">
                  {notif.message}
                </p>
              </div>

              <button
                id={`btn-dismiss-torch-${notif.id}`}
                onClick={() => onDismiss(notif.id)}
                aria-label="Dismiss notification"
                className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <SolarIcon name="close-circle-bold-duotone" className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
