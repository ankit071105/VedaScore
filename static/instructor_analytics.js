// Student Analytics Dashboard
class StudentAnalytics {
    constructor() {
        this.charts = {};
        this.analyticsData = {};
        this.init();
    }

    async init() {
        await this.loadAnalyticsData();
        this.renderCharts();
        this.setupEventListeners();
    }

    async loadAnalyticsData() {
        try {
            // Load student assignments and submissions
            const assignmentsResponse = await fetch('/api/student_assignments');
            const assignmentsData = await assignmentsResponse.json();

            // Load code execution history (mock data for demo)
            const executionHistory = this.getMockExecutionHistory();

            this.processAnalyticsData(assignmentsData, executionHistory);
        } catch (error) {
            console.error('Error loading analytics data:', error);
        }
    }

    processAnalyticsData(assignmentsData, executionHistory) {
        this.analyticsData.assignments = assignmentsData.assignments || [];
        this.analyticsData.executionHistory = executionHistory;

        this.calculatePerformanceMetrics();
        this.calculateProgressTrends();
        this.calculateCodeAnalytics();
    }

    calculatePerformanceMetrics() {
        const assignments = this.analyticsData.assignments;
        
        const submittedAssignments = assignments.filter(a => a.is_submitted);
        const totalAssignments = assignments.length;
        const completionRate = totalAssignments > 0 ? Math.round((submittedAssignments.length / totalAssignments) * 100) : 0;

        // Calculate average success rate
        const totalSuccessRate = submittedAssignments.reduce((sum, assignment) => {
            const successRate = assignment.total_tests > 0 
                ? Math.round((assignment.passed_tests / assignment.total_tests) * 100)
                : 0;
            return sum + successRate;
        }, 0);
        
        const averageSuccessRate = submittedAssignments.length > 0 
            ? Math.round(totalSuccessRate / submittedAssignments.length)
            : 0;

        this.analyticsData.metrics = {
            totalAssignments,
            submittedAssignments: submittedAssignments.length,
            completionRate,
            averageSuccessRate
        };
    }

    calculateProgressTrends() {
        const assignments = this.analyticsData.assignments;
        
        // Sort assignments by due date and track progress
        const sortedAssignments = [...assignments].sort((a, b) => 
            new Date(a.due_date) - new Date(b.due_date)
        );

        const progressData = [];
        let cumulativeCompleted = 0;

        sortedAssignments.forEach((assignment, index) => {
            if (assignment.is_submitted) {
                cumulativeCompleted++;
            }
            progressData.push({
                assignment: assignment.title,
                date: assignment.due_date,
                completed: assignment.is_submitted,
                cumulativeProgress: Math.round((cumulativeCompleted / (index + 1)) * 100)
            });
        });

        this.analyticsData.progressTrends = progressData;
    }

    calculateCodeAnalytics() {
        const executionHistory = this.analyticsData.executionHistory;
        
        // Analyze code execution patterns
        const languageUsage = {};
        const errorTypes = {};
        const executionTimes = [];

        executionHistory.forEach(execution => {
            // Language usage
            languageUsage[execution.language] = (languageUsage[execution.language] || 0) + 1;
            
            // Error types
            if (!execution.success) {
                const errorType = this.categorizeError(execution.error);
                errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
            }
            
            // Execution times
            executionTimes.push(execution.executionTime);
        });

        this.analyticsData.codeAnalytics = {
            languageUsage,
            errorTypes,
            averageExecutionTime: executionTimes.length > 0 
                ? Math.round(executionTimes.reduce((a, b) => a + b) / executionTimes.length)
                : 0,
            totalExecutions: executionHistory.length,
            successfulExecutions: executionHistory.filter(e => e.success).length
        };
    }

    categorizeError(error) {
        if (!error) return 'Unknown';
        
        const errorLower = error.toLowerCase();
        if (errorLower.includes('syntax')) return 'Syntax Error';
        if (errorLower.includes('type')) return 'Type Error';
        if (errorLower.includes('name')) return 'Name Error';
        if (errorLower.includes('index')) return 'Index Error';
        if (errorLower.includes('value')) return 'Value Error';
        if (errorLower.includes('import')) return 'Import Error';
        return 'Runtime Error';
    }

    getMockExecutionHistory() {
        // Mock data for demonstration
        return [
            { language: 'Python', success: true, executionTime: 120, timestamp: new Date(Date.now() - 86400000) },
            { language: 'Python', success: false, executionTime: 80, error: 'SyntaxError: invalid syntax', timestamp: new Date(Date.now() - 172800000) },
            { language: 'JavaScript', success: true, executionTime: 200, timestamp: new Date(Date.now() - 259200000) },
            { language: 'Python', success: true, executionTime: 150, timestamp: new Date(Date.now() - 345600000) },
            { language: 'Python', success: false, executionTime: 90, error: 'NameError: undefined variable', timestamp: new Date(Date.now() - 432000000) }
        ];
    }

    renderCharts() {
        this.renderPerformanceChart();
        this.renderProgressChart();
        this.renderLanguageUsageChart();
        this.renderErrorAnalysisChart();
        this.renderQuickStats();
    }

    renderPerformanceChart() {
        const ctx = document.getElementById('student-performance-chart');
        if (!ctx) return;

        const metrics = this.analyticsData.metrics;
        
        this.charts.performance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Pending'],
                datasets: [{
                    data: [
                        metrics.submittedAssignments,
                        metrics.totalAssignments - metrics.submittedAssignments
                    ],
                    backgroundColor: ['#10b981', '#6b7280'],
                    borderWidth: 2,
                    borderColor: '#0b0f19'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e0e6f0',
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Assignment Completion',
                        color: '#e0e6f0',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    }

    renderProgressChart() {
        const ctx = document.getElementById('student-progress-chart');
        if (!ctx) return;

        const progressTrends = this.analyticsData.progressTrends;
        
        this.charts.progress = new Chart(ctx, {
            type: 'line',
            data: {
                labels: progressTrends.map(p => p.assignment),
                datasets: [{
                    label: 'Cumulative Progress (%)',
                    data: progressTrends.map(p => p.cumulativeProgress),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e6f0'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Learning Progress Over Time',
                        color: '#e0e6f0',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#a0aec0',
                            maxRotation: 45
                        },
                        grid: {
                            color: 'rgba(160, 174, 192, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#a0aec0'
                        },
                        grid: {
                            color: 'rgba(160, 174, 192, 0.1)'
                        },
                        max: 100
                    }
                }
            }
        });
    }

    renderLanguageUsageChart() {
        const ctx = document.getElementById('language-usage-chart');
        if (!ctx) return;

        const codeAnalytics = this.analyticsData.codeAnalytics;
        const languages = Object.keys(codeAnalytics.languageUsage);
        const usageCounts = languages.map(lang => codeAnalytics.languageUsage[lang]);

        this.charts.languageUsage = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: languages,
                datasets: [{
                    label: 'Code Executions',
                    data: usageCounts,
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e0e6f0'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Programming Language Usage',
                        color: '#e0e6f0',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#a0aec0'
                        },
                        grid: {
                            color: 'rgba(160, 174, 192, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#a0aec0'
                        },
                        grid: {
                            color: 'rgba(160, 174, 192, 0.1)'
                        }
                    }
                }
            }
        });
    }

    renderErrorAnalysisChart() {
        const ctx = document.getElementById('error-analysis-chart');
        if (!ctx) return;

        const codeAnalytics = this.analyticsData.codeAnalytics;
        const errorTypes = Object.keys(codeAnalytics.errorTypes);
        const errorCounts = errorTypes.map(type => codeAnalytics.errorTypes[type]);

        this.charts.errorAnalysis = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: errorTypes,
                datasets: [{
                    data: errorCounts,
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#8b5cf6',
                        '#3b82f6',
                        '#10b981',
                        '#6b7280'
                    ],
                    borderWidth: 2,
                    borderColor: '#0b0f19'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e0e6f0',
                            font: {
                                size: 12
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Error Type Distribution',
                        color: '#e0e6f0',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    }

    renderQuickStats() {
        const container = document.getElementById('student-quick-stats');
        if (!container) return;

        const metrics = this.analyticsData.metrics;
        const codeAnalytics = this.analyticsData.codeAnalytics;

        container.innerHTML = `
            <div class="stat-card" style="background: var(--secondary); padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #10b981;">
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${metrics.completionRate}%</div>
                <div style="color: #a0aec0; font-size: 14px;">Completion Rate</div>
            </div>
            <div class="stat-card" style="background: var(--secondary); padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #3b82f6;">
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${metrics.averageSuccessRate}%</div>
                <div style="color: #a0aec0; font-size: 14px;">Avg Success Rate</div>
            </div>
            <div class="stat-card" style="background: var(--secondary); padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #8b5cf6;">
                <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${codeAnalytics.totalExecutions}</div>
                <div style="color: #a0aec0; font-size: 14px;">Code Executions</div>
            </div>
            <div class="stat-card" style="background: var(--secondary); padding: 20px; border-radius: 12px; text-align: center; border-left: 4px solid #f59e0b;">
                <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${codeAnalytics.successfulExecutions}</div>
                <div style="color: #a0aec0; font-size: 14px;">Successful Runs</div>
            </div>
        `;
    }

    setupEventListeners() {
        // Refresh analytics every minute
        setInterval(() => {
            this.loadAnalyticsData().then(() => {
                this.renderCharts();
            });
        }, 60000);
    }
}

// Initialize analytics when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StudentAnalytics();
});