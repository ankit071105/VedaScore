
        // DOM Elements
        const codeEditor = document.getElementById('code-editor');
        const outputContainer = document.getElementById('output-container');
        const filenameInput = document.getElementById('filename-input');
        
        const sidebarAssignmentsDeadlines = document.getElementById('sidebar-assignments-deadlines');
        const assignmentCompletionStatus = document.getElementById('assignment-completion-status');
        const aiFeedbackDashboardContainer = document.getElementById('ai-feedback-dashboard-container');
        const impQuizDashboardContainer = document.getElementById('imp-quiz-dashboard-container');

        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Helper function to parse quiz markdown and highlight the correct answer (moved to global scope)
        function parseQuizMarkdown(markdown) {
            const lines = markdown.split('\n').filter(line => line.trim() !== '');
            let html = '';
            let currentQuestion = {};

            lines.forEach(line => {
                if (line.startsWith('### Question')) {
                    if (currentQuestion.text) {
                        html += renderQuestion(currentQuestion);
                    }
                    currentQuestion = { text: line.substring(line.indexOf(' ') + 1).trim(), options: [], correctAnswer: '' };
                } else if (line.match(/^[a-d]\)/)) {
                    currentQuestion.options.push(line.trim());
                } else if (line.startsWith('Correct Answer:')) {
                    currentQuestion.correctAnswer = line.split(':')[1].trim().toLowerCase();
                } else if (currentQuestion.text && !currentQuestion.options.length) { // Question text can span multiple lines
                    currentQuestion.text += '\n' + line.trim();
                } else if (line.startsWith('### Important Exam Questions')) {
                     // Render any pending question first
                    if (currentQuestion.text) {
                        html += renderQuestion(currentQuestion);
                        currentQuestion = {};
                    }
                    // Add the Important Exam Questions header directly
                    html += marked.parse(line + '\n'); // Use marked.parse for this heading and subsequent content
                } else {
                     // If it's general text outside a question, or exam questions content
                    html += marked.parse(line + '\n');
                }
            });

            // Render the last question if any
            if (currentQuestion.text) {
                html += renderQuestion(currentQuestion);
            }

            return html;
        }

        function renderQuestion(question) {
            let questionHtml = `<div style="margin-bottom: 20px;">`;
            questionHtml += marked.parse(question.text + '\n'); // Render question text as markdown

            questionHtml += `<ul style="list-style-type: none; padding-left: 0;">`;
            question.options.forEach(option => {
                const optionLetter = option.substring(0, option.indexOf(')')).trim().toLowerCase();
                const isCorrect = question.correctAnswer.includes(optionLetter);
                questionHtml += `<li style="margin-bottom: 5px;"><span class="${isCorrect ? 'quiz-option-correct' : ''}">${escapeHtml(option)}</span></li>`;
            });
            questionHtml += `</ul>`;

            if (question.correctAnswer) {
                questionHtml += `<p style="margin-top: 10px; font-weight: bold;">Correct Answer: ${escapeHtml(question.correctAnswer.toUpperCase())}</p>`;
            }
            questionHtml += `</div>`;
            return questionHtml;
        }

        // Button Elements
        const runCodeBtn = document.getElementById('run-code-btn');
        const explainCodeBtn = document.getElementById('explain-code-btn');
        const checkErrorsBtn = document.getElementById('check-errors-btn');
        const convertCodeBtn = document.getElementById('convert-code-btn');
        const copyCodeBtn = document.getElementById('copy-code-btn');
        const plagiarismCheckBtn = document.getElementById('plagiarism-check-btn');
        const optimizeCodeBtn = document.getElementById('optimize-code-btn');
        const documentCodeBtn = document.getElementById('document-code-btn');
        const debugCodeBtn = document.getElementById('debug-code-btn');
        const newFileBtn = document.getElementById('new-file-btn');
        const saveFileBtn = document.getElementById('save-file-btn');
        const uploadFileBtn = document.getElementById('upload-file-btn');

        // API Call Function
        async function callAPI(endpoint, data) {
            outputContainer.textContent = "Processing...";
            
            try {
                const response = await fetch(`/api/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    return result;
                } else {
                    throw new Error(result.error || 'API call failed');
                }
            } catch (error) {
                outputContainer.textContent = `Error: ${error.message}`;
                return null;
            }
        }

        // Event Listeners
        runCodeBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('run_code', { code });
            if (result) {
                outputContainer.textContent = result.output;
            }
        });

        explainCodeBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('explain_code', { code });
            if (result) {
                outputContainer.textContent = result.explanation;
            }
        });

        checkErrorsBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('check_errors', { code });
            if (result) {
                outputContainer.textContent = result.errors;
            }
        });

        convertCodeBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const targetLanguage = prompt("Enter target language (e.g., JavaScript, Java, C++):", "JavaScript");
            if (targetLanguage) {
                const result = await callAPI('convert_code', { code, target_language: targetLanguage });
                if (result) {
                    outputContainer.textContent = result.converted_code;
                }
            }
        });

        copyCodeBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(codeEditor.textContent)
                .then(() => {
                    outputContainer.textContent = "Code copied to clipboard!";
                })
                .catch(err => {
                    outputContainer.textContent = "Failed to copy code: " + err;
                });
        });

        plagiarismCheckBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('check_plagiarism', { code });
            if (result) {
                outputContainer.textContent = `Plagiarism Analysis:\nSimilarity Score: ${result.similarity_score}%\nOriginality Score: ${result.originality_score}%\n\n${result.plagiarism_analysis}`;
            }
        });

        optimizeCodeBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('optimize_code', { code });
            if (result) {
                outputContainer.textContent = result.optimized_code;
            }
        });

        documentCodeBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('document_code', { code }); // Assuming a new API endpoint for document code
            if (result) {
                outputContainer.textContent = result.documentation; // Assuming 'documentation' field in response
            }
        });

        debugCodeBtn.addEventListener('click', async () => {
            const code = codeEditor.textContent;
            const result = await callAPI('debug_code', { code });
            if (result) {
                outputContainer.textContent = result.debug_info;
            }
        });

        newFileBtn.addEventListener('click', () => {
            codeEditor.textContent = "# New file\n# Start coding here...";
            filenameInput.value = "new_file.py";
            outputContainer.textContent = "New file created. Start coding!";
        });

        saveFileBtn.addEventListener('click', async () => {
            const filename = filenameInput.value;
            const content = codeEditor.textContent;
            
            const result = await callAPI('save_file', { filename, content });
            if (result) {
                outputContainer.textContent = result.message;
                // Refresh file list
                location.reload();
            }
        });

        uploadFileBtn.addEventListener('click', () => {
            outputContainer.textContent = "File upload feature would be implemented here.";
        });

        // Load file when clicked
        document.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileId = item.dataset.fileId;
                
                try {
                    const response = await fetch(`/api/load_file/${fileId}`);
                    const result = await response.json();
                    
                    if (response.ok) {
                        filenameInput.value = result.filename;
                        codeEditor.textContent = result.content;
                        outputContainer.textContent = `File "${result.filename}" loaded successfully!`;
                    } else {
                        outputContainer.textContent = `Error: ${result.error}`;
                    }
                } catch (error) {
                    outputContainer.textContent = `Error loading file: ${error.message}`;
                }
            });
        });

        // Initialize with welcome message
        outputContainer.textContent = "Welcome to VedaScore! Use the buttons above to interact with your code.";

        // Load assignments and their deadlines into the sidebar
        async function loadSidebarAssignments() {
            try {
                const response = await fetch('/api/student_assignments');
                const result = await response.json();
                const assignments = result.assignments; // Get the assignments array

                if (assignments && assignments.length > 0) {
                    const now = new Date();
                    const mainAssignmentsList = document.getElementById('assignmentsScroll').querySelector('.assignments-list');
                    mainAssignmentsList.innerHTML = ''; // Clear existing entries
                    assignments.forEach(assignment => {
                        const listItem = document.createElement('li');
                        listItem.classList.add('assignment-item');
                        if (assignment.is_submitted) {
                            listItem.classList.add('submitted');
                        }

                        const dueDate = new Date(assignment.due_date);
                        const timeDiff = dueDate.getTime() - now.getTime();
                        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                        
                        let daysLeftText;
                        if (daysLeft > 0) {
                            daysLeftText = `(${daysLeft} days left)`;
                        } else if (daysLeft === 0) {
                            daysLeftText = '(Due Today)';
                        } else {
                            daysLeftText = '(Overdue)';
                        }

                        const progressPercentage = assignment.total_tests > 0 ? Math.round((assignment.passed_tests / assignment.total_tests) * 100) : 0;

                        listItem.innerHTML = `
                            <div class="assignment-header">
                                <a href="/assignment/${assignment.id}" class="assignment-title-link">
                                    <div class="assignment-title">${assignment.title}</div>
                                </a>
                                <div class="assignment-due">Due: ${dueDate.toLocaleDateString()} ${daysLeftText || ''}
                                    ${assignment.is_submitted ? '<span style="color: var(--success); font-weight: bold; margin-left: 10px;">Submitted</span>' : ''}
                                </div>
                            </div>
                            <div class="assignment-desc">
                                ${assignment.description}
                            </div>
                            <div class="assignment-progress">
                                <div class="progress-bar">
                                    <div class="progress-value" style="width: ${progressPercentage}%"></div>
                                </div>
                                <div class="progress-text">${progressPercentage}%</div>
                            </div>
                        `;
                        mainAssignmentsList.appendChild(listItem);
                    });
                    updateAssignmentsFades();

                    // Update sidebar assignments with submission status
                    sidebarAssignmentsDeadlines.innerHTML = ''; // Clear existing entries
                    assignments.forEach(assignment => {
                        const listItem = document.createElement('li');
                        const dueDate = new Date(assignment.due_date);
                        const timeDiff = dueDate.getTime() - now.getTime();
                        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                        
                        let daysLeftText;
                        if (daysLeft > 0) {
                            daysLeftText = `(${daysLeft} days left)`;
                        } else if (daysLeft === 0) {
                            daysLeftText = '(Due Today)';
                        } else {
                            daysLeftText = '(Overdue)';
                        }

                        let statusText = assignment.is_submitted ? ' - Submitted' : '';
                        let statusClass = assignment.is_submitted ? 'submitted' : '';

                        listItem.innerHTML = `<strong>${assignment.title}</strong> - ${dueDate.toLocaleDateString()} ${daysLeftText || ''} <span class="assignment-status ${statusClass}">${statusText}</span>`;
                        sidebarAssignmentsDeadlines.appendChild(listItem);
                    });

                    // Also update completion status here
                    await updateCompletionStatus(assignments);

                    // Ensure initial fade states are correct after new content
                    const scrollEl = document.getElementById('assignmentsScroll');
                    if (scrollEl) {
                        scrollEl.dispatchEvent(new Event('scroll'));
                    }
                    
                    // Fetch AI content for the dashboard
                    fetchAIContentForDashboard(assignments);

                } else {
                    sidebarAssignmentsDeadlines.innerHTML = '<li>No assignments found.</li>';
                    assignmentCompletionStatus.textContent = 'No assignments to track.';
                    aiFeedbackDashboardContainer.innerHTML = '<i class="fas fa-info-circle"></i> No assignments available to generate feedback.';
                    impQuizDashboardContainer.innerHTML = '<i class="fas fa-info-circle"></i> No assignments available to generate quiz questions.';
                }
            } catch (error) {
                console.error("Error loading sidebar assignments:", error);
                sidebarAssignmentsDeadlines.innerHTML = '<li>Error loading assignments.</li>';
                aiFeedbackDashboardContainer.innerHTML = `<span style="color: var(--danger);">Error loading assignments for AI feedback: ${error.message}</span>`;
                impQuizDashboardContainer.innerHTML = `<span style="color: var(--danger);">Error loading assignments for Imp/Quiz: ${error.message}</span>`;
            }
        }
        
        loadSidebarAssignments(); // Call on initial load

        // Function to fetch and display AI content for the dashboard
        async function fetchAIContentForDashboard(assignments) {
            const assignmentDescriptions = assignments.map(a => a.description).join('\n\n');

            // Fetch AI Feedback for Dashboard
            aiFeedbackDashboardContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating general AI feedback...';
            try {
                const response = await fetch('/api/get_ai_feedback_dashboard', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ assignments_description: assignmentDescriptions })
                });
                const result = await response.json();
                if (response.ok) {
                    aiFeedbackDashboardContainer.innerHTML = marked.parse(result.feedback);
                } else {
                    aiFeedbackDashboardContainer.innerHTML = `<span style="color: var(--danger);">Error generating AI feedback: ${result.error || 'Unknown error'}</span>`;
                }
            } catch (error) {
                aiFeedbackDashboardContainer.innerHTML = `<span style="color: var(--danger);">Network Error fetching AI feedback: ${error.message}</span>`;
            }

            // Fetch Imp/Quiz for Dashboard (and set up interval for refreshing quiz)
            async function fetchAndDisplayQuiz() {
                impQuizDashboardContainer.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating quiz questions...';
                try {
                    const response = await fetch('/api/get_imp_quiz_dashboard', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ assignments_description: assignmentDescriptions })
                    });
                    const result = await response.json();
                    if (response.ok) {
                        // Manually parse markdown to highlight correct answers
                        const quizMarkdown = result.content;
                        const quizHtml = parseQuizMarkdown(quizMarkdown);
                        impQuizDashboardContainer.innerHTML = quizHtml;
                    } else {
                        impQuizDashboardContainer.innerHTML = `<span style="color: var(--danger);">Error generating Imp/Quiz: ${result.error || 'Unknown error'}</span>`;
                    }
                } catch (error) {
                    impQuizDashboardContainer.innerHTML = `<span style="color: var(--danger);">Network Error fetching Imp/Quiz: ${error.message}</span>`;
                }
            }

            fetchAndDisplayQuiz(); // Initial call
            setInterval(fetchAndDisplayQuiz, 30000); // Refresh every 30 seconds
        }

        // Scroll fade helpers for assignments list
        function updateAssignmentsFades() {
            const scrollEl = document.getElementById('assignmentsScroll');
            const topFade = document.getElementById('assignmentsFadeTop');
            const bottomFade = document.getElementById('assignmentsFadeBottom');
            if (!scrollEl) return;

            const scrollTop = scrollEl.scrollTop;
            const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;

            if (topFade) {
                topFade.classList.toggle('visible', scrollTop > 8);
            }
            if (bottomFade) {
                bottomFade.classList.toggle('visible', scrollTop < maxScroll - 8);
            }
        }

        // Attach listener and initialize
        document.addEventListener('DOMContentLoaded', () => {
            const scrollEl = document.getElementById('assignmentsScroll');
            if (scrollEl) {
                scrollEl.addEventListener('scroll', () => updateAssignmentsFades());
                // initialize state (in case content already overflows)
                updateAssignmentsFades();
            }
        });

        // Function to update completion status
        async function updateCompletionStatus(assignmentsData) {
            if (!assignmentsData || assignmentsData.length === 0) {
                assignmentCompletionStatus.textContent = 'No assignments to track.';
                return;
            }

            let completedAssignmentsCount = 0;
            for (const assignment of assignmentsData) {
                if (assignment.is_submitted) {
                    completedAssignmentsCount++;
                }
            }

            const totalAssignments = assignmentsData.length;
            assignmentCompletionStatus.innerHTML = `<p>${completedAssignmentsCount} of ${totalAssignments} assignments completed.</p>`;
        }

        // Remove this section as progress is now data-driven
        // document.querySelectorAll('[data-progress-width]').forEach(element => {
        //     const randomWidth = [25, 50, 75][Math.floor(Math.random() * 3)];
        //     element.style.width = `${randomWidth}%`;
        //     const percentageTextElement = element.closest('.assignment-progress').querySelector('.progress-percentage');
        //     if (percentageTextElement) {
        //         percentageTextElement.textContent = randomWidth;
        //     }
        // });
