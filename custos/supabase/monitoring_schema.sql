-- ============================================
-- PLATFORM MONITORING & ERROR LOGGING
-- The Unbreakable Foundation
-- ============================================

-- Error logs table (all errors captured here)
CREATE TABLE IF NOT EXISTS error_logs (
  error_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Context
  school_id UUID REFERENCES schools(school_id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  
  -- Error details
  error_type TEXT NOT NULL,  -- 'api', 'database', 'ai_service', 'frontend', 'auth'
  feature_name TEXT NOT NULL,  -- Which feature failed
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  
  -- Request context
  request_url TEXT,
  request_method TEXT,
  request_data JSONB,
  
  -- System state at time of error
  system_state JSONB,
  /*
  {
    "cpu_usage": "45%",
    "memory_usage": "2.1GB",
    "active_users": 234,
    "db_connections": 12
  }
  */
  
  -- Impact assessment
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  user_impacted BOOLEAN DEFAULT true,
  feature_disabled BOOLEAN DEFAULT false,
  auto_recovered BOOLEAN DEFAULT false,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(user_id),
  resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- System health metrics (captured every 30 seconds)
CREATE TABLE IF NOT EXISTS system_health_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Database health
  db_status TEXT,  -- 'healthy', 'degraded', 'down'
  db_response_time_ms INTEGER,
  db_connection_count INTEGER,
  
  -- API health
  api_status TEXT,
  api_avg_response_ms INTEGER,
  api_error_rate DECIMAL,
  
  -- AI service health
  ai_service_status TEXT,
  ai_service_uptime_percent DECIMAL,
  ai_requests_last_minute INTEGER,
  
  -- Frontend health
  frontend_crash_count INTEGER,
  active_sessions INTEGER,
  
  -- Overall
  overall_status TEXT CHECK (overall_status IN ('operational', 'degraded', 'major_outage')),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Feature status (track which features are enabled/disabled)
CREATE TABLE IF NOT EXISTS feature_status (
  feature_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  
  feature_name TEXT NOT NULL,
  feature_key TEXT NOT NULL,  -- 'ai_extraction', 'lesson_planning', etc.
  
  is_enabled BOOLEAN DEFAULT true,
  disabled_reason TEXT,
  disabled_at TIMESTAMP,
  
  auto_disable_on_error BOOLEAN DEFAULT true,
  
  last_error_at TIMESTAMP,
  error_count_24h INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(school_id, feature_key)
);

-- Platform-wide alerts
CREATE TABLE IF NOT EXISTS platform_alerts (
  alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  alert_type TEXT NOT NULL,  -- 'error_spike', 'service_down', 'high_load', 'security'
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'warning',
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  affected_schools INTEGER DEFAULT 0,
  affected_users INTEGER DEFAULT 0,
  
  action_required BOOLEAN DEFAULT false,
  action_taken TEXT,
  
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMP,
  
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_error_logs_school ON error_logs(school_id);
CREATE INDEX idx_error_logs_user ON error_logs(user_id);
CREATE INDEX idx_error_logs_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON error_logs(resolved) WHERE resolved = false;

CREATE INDEX idx_health_metrics_created ON system_health_metrics(created_at DESC);
CREATE INDEX idx_health_metrics_status ON system_health_metrics(overall_status);

CREATE INDEX idx_feature_status_school ON feature_status(school_id);
CREATE INDEX idx_feature_status_enabled ON feature_status(is_enabled);

CREATE INDEX idx_alerts_severity ON platform_alerts(severity);
CREATE INDEX idx_alerts_unresolved ON platform_alerts(resolved) WHERE resolved = false;

-- RLS Policies (Platform Owners only)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated (we'll add platform_owner role later)
CREATE POLICY "Allow authenticated to view error_logs" ON error_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to view health metrics" ON system_health_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to view feature status" ON feature_status
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated to view alerts" ON platform_alerts
  FOR SELECT TO authenticated USING (true);

-- Triggers
CREATE TRIGGER update_feature_status_updated_at BEFORE UPDATE ON feature_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE error_logs IS 'Platform-wide error logging for monitoring and debugging';
COMMENT ON TABLE system_health_metrics IS 'Real-time system health metrics captured every 30s';
COMMENT ON TABLE feature_status IS 'Track enabled/disabled features per school';
COMMENT ON TABLE platform_alerts IS 'Critical alerts for platform owners';
