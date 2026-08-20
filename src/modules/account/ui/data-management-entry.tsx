import { DataManagement } from "./data-management";

export const DataManagementEntry = ({ reauth }: Readonly<{ reauth: { exportRequiresReauth: boolean; deleteRequiresReauth: boolean } }>) => <DataManagement reauth={reauth} />;
