import { FC } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Activity, 
  Database, 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle 
} from "lucide-react";

interface SystemMetrics {
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  activeSessions: number;
  databaseStatus: {
    isConnected: boolean;
    connectionCount: number;
    idleConnections: number;
  };
  lastMinuteRequests: number;
  errorRate: number;
}

const formatBytes = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i))) + ' ' + sizes[i];
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

export const HealthDashboard: FC = () => {
  const { data: metrics, error, isLoading } = useQuery<SystemMetrics>({
    queryKey: ['/api/health'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) return <div>Loading health metrics...</div>;
  if (error) return <div>Error loading health metrics</div>;
  if (!metrics) return null;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">System Health Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* System Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(metrics.uptime)}</div>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
            </div>
            <Progress value={metrics.memory.usagePercent} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.memory.usagePercent.toFixed(1)}% used
            </p>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeSessions}</div>
          </CardContent>
        </Card>

        {/* Database Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Alert className={metrics.databaseStatus.isConnected ? "bg-green-50" : "bg-red-50"}>
              <div className="flex items-center gap-2">
                {metrics.databaseStatus.isConnected ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <AlertTitle>
                  {metrics.databaseStatus.isConnected ? "Connected" : "Disconnected"}
                </AlertTitle>
              </div>
              <AlertDescription className="mt-2">
                Active connections: {metrics.databaseStatus.connectionCount}
                <br />
                Idle connections: {metrics.databaseStatus.idleConnections}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Request Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requests (Last Minute)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.lastMinuteRequests}</div>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.errorRate.toFixed(1)}%</div>
            <Progress 
              value={metrics.errorRate} 
              className={`mt-2 ${metrics.errorRate > 5 ? "bg-red-500" : "bg-yellow-500"}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HealthDashboard;