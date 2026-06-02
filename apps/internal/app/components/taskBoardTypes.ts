import type { AppRole } from "@central-vet/db";

export type TaskBoardSession = {
  name: string;
  role: AppRole;
  passcode?: string;
  profileId?: string | null;
};
