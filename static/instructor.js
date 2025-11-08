
    document.addEventListener('DOMContentLoaded', () => {
        const assignmentUploadButton = document.getElementById('assignment-upload-button');
        const assignmentUploadInput = document.getElementById('assignment-upload-input');
        const getTestCasesButton = document.getElementById('get-ai-test-cases-button');
        const assignmentDescriptionInput = document.getElementById('assignment-description');
        const assignmentDeadlineInput = document.getElementById('assignment-deadline');
        const newAssignmentForm = document.getElementById('new-assignment-form');
        const liveAssignmentsList = document.getElementById('live-assignments-list');
        const pastAssignmentsList = document.getElementById('past-assignments-list');
        const assignmentTitleInput = document.getElementById('assignment-title');
        const assignmentTestCasesTextarea = document.getElementById('assignment-test-cases');
        const receivedSubmissionsList = document.getElementById('received-submissions-list');
        const leaderboardTableBody = document.querySelector('.leaderboard-card tbody');
        const studentSubmissionsContainer = document.getElementById('student-submissions-container');

        // Plagiarism Checker Elements
        const assignmentSelect = document.getElementById('assignment-select');
        const checkPlagiarismBtn = document.getElementById('check-plagiarism-btn');
        const plagiarismResults = document.getElementById('plagiarism-results');
        const plagiarismResultsContainer = document.getElementById('plagiarism-results-container');

        // Modal Elements
        const codeModal = document.getElementById('code-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalCodeContent = document.getElementById('modal-code-content');
        const modalOutputContent = document.getElementById('modal-output-content');
        const closeModal = document.querySelector('.close-modal');
        const checkPlagiarismModalBtn = document.getElementById('check-plagiarism-modal-btn');
        const analyzeCodeBtn = document.getElementById('analyze-code-btn');
        const deleteSubmissionBtn = document.getElementById('delete-submission-btn');

        // Confirmation Modal Elements
        const confirmationModal = document.getElementById('confirmation-modal');
        const confirmationTitle = document.getElementById('confirmation-title');
        const confirmationMessage = document.getElementById('confirmation-message');
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

        let currentSubmissionId = null;
        
        // Mock database for client-side deletion (as fallback)
        let deletedSubmissions = JSON.parse(localStorage.getItem('deletedSubmissions') || '[]');

        // Function to load and display student submissions with delete filtering
        async function loadStudentSubmissions() {
            try {
                const response = await fetch('/api/instructor_submissions');
                const data = await response.json();

                if (response.ok && data.submissions) {
                    studentSubmissionsContainer.innerHTML = '';
                    
                    // Filter out deleted submissions
                    const activeSubmissions = data.submissions.filter(
                        submission => !deletedSubmissions.includes(submission.submission_id.toString())
                    );
                    
                    if (activeSubmissions.length > 0) {
                        activeSubmissions.forEach(submission => {
                            const submissionItem = document.createElement('div');
                            submissionItem.className = 'submission-item';
                            
                            const successRate = submission.success_rate || 0;
                            const scoreClass = successRate >= 70 ? 'score-passed' : 'score-failed';
                            
                            submissionItem.innerHTML = `
                                <div class="submission-header">
                                    <div class="student-info">
                                        ${submission.student_name} (${submission.student_email})
                                        <div class="submission-meta">
                                            Assignment: ${submission.assignment_title} | 
                                            Submitted: ${submission.submission_time}
                                        </div>
                                    </div>
                                    <div class="score-badge ${scoreClass}">
                                        ${submission.passed_tests}/${submission.total_tests} (${successRate}%)
                                    </div>
                                </div>
                                <div class="test-results">
                                    <strong>Test Results:</strong>
                                    ${submission.test_results && submission.test_results.length > 0 ? 
                                        submission.test_results.map(test => `
                                            <div class="test-case ${test.passed ? 'passed' : 'failed'}">
                                                Test ${test.case_num}: 
                                                Input: ${test.input} | 
                                                Expected: ${test.expected} | 
                                                Actual: ${test.actual} |
                                                <strong>${test.passed ? 'PASSED' : 'FAILED'}</strong>
                                            </div>
                                        `).join('') : 
                                        '<div>No test results available</div>'
                                    }
                                </div>
                                <div class="submission-actions">
                                    <button class="btn btn-primary view-code-btn" data-submission-id="${submission.submission_id}">
                                        <i class="fas fa-code"></i> View Code
                                    </button>
                                    <button class="btn btn-warning check-plagiarism-btn" data-submission-id="${submission.submission_id}">
                                        <i class="fas fa-search"></i> Check Plagiarism
                                    </button>
                                    <button class="btn btn-danger delete-submission-btn" data-submission-id="${submission.submission_id}" data-student-name="${submission.student_name}" data-assignment-title="${submission.assignment_title}">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                            `;
                            studentSubmissionsContainer.appendChild(submissionItem);
                        });

                        // Add event listeners to buttons
                        attachEventListeners();

                    } else {
                        studentSubmissionsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #a0aec0;"><i class="fas fa-inbox"></i> No submissions received yet.</div>';
                    }
                } else {
                    console.error('Error loading submissions:', data.error);
                    studentSubmissionsContainer.innerHTML = '<div style="color: var(--danger); text-align: center; padding: 20px;">Error loading submissions.</div>';
                }
            } catch (error) {
                console.error('Error fetching submissions:', error);
                studentSubmissionsContainer.innerHTML = '<div style="color: var(--danger); text-align: center; padding: 20px;">Error fetching submissions.</div>';
            }
        }

        // Function to attach event listeners to dynamic elements
        function attachEventListeners() {
            // Add event listeners to view code buttons
            document.querySelectorAll('.view-code-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const submissionId = e.target.closest('.view-code-btn').dataset.submissionId;
                    viewSubmissionCode(submissionId);
                });
            });

            // Add event listeners to plagiarism check buttons
            document.querySelectorAll('.check-plagiarism-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const submissionId = e.target.closest('.check-plagiarism-btn').dataset.submissionId;
                    checkSubmissionPlagiarism(submissionId);
                });
            });

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-submission-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const submissionId = e.target.closest('.delete-submission-btn').dataset.submissionId;
                    const studentName = e.target.closest('.delete-submission-btn').dataset.studentName;
                    const assignmentTitle = e.target.closest('.delete-submission-btn').dataset.assignmentTitle;
                    showDeleteConfirmation(submissionId, studentName, assignmentTitle);
                });
            });
        }

        // Function to view submission code in modal
        async function viewSubmissionCode(submissionId) {
            try {
                const response = await fetch('/api/instructor_submissions');
                const data = await response.json();

                if (response.ok && data.submissions) {
                    const submission = data.submissions.find(s => s.submission_id == submissionId);
                    if (submission) {
                        currentSubmissionId = submissionId;
                        modalTitle.textContent = `Code Submission - ${submission.student_name} - ${submission.assignment_title}`;
                        modalCodeContent.textContent = submission.code;
                        modalOutputContent.textContent = submission.output || 'No output available';
                        codeModal.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Error loading submission code:', error);
                alert('Error loading submission code');
            }
        }

        // Function to check plagiarism for a specific submission
        async function checkSubmissionPlagiarism(submissionId) {
            try {
                const response = await fetch(`/api/plagiarism/check_submission/${submissionId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    let resultsHTML = `
                        <h4 style="color: var(--primary-light); margin-bottom: 15px;">
                            <i class="fas fa-search"></i> Plagiarism Analysis Results
                        </h4>
                        <div style="margin-bottom: 15px;">
                            <strong>Submission:</strong> ${data.submission_checked.student_name} - ${data.submission_checked.assignment_title}
                        </div>
                    `;

                    if (data.similarities && data.similarities.length > 0) {
                        resultsHTML += `
                            <div style="color: var(--danger); margin-bottom: 15px;">
                                <i class="fas fa-exclamation-triangle"></i> 
                                <strong>Potential Plagiarism Detected</strong>
                            </div>
                            <div>
                                <strong>Similar Submissions Found:</strong>
                        `;

                        data.similarities.forEach(similarity => {
                            let severityColor = 'var(--info)';
                            if (similarity.similarity_score > 70) severityColor = 'var(--danger)';
                            else if (similarity.similarity_score > 40) severityColor = 'var(--warning)';

                            resultsHTML += `
                                <div style="padding: 10px; margin: 8px 0; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid ${severityColor};">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <strong>${similarity.student_name} (${similarity.student_email})</strong>
                                        <span style="color: ${severityColor}; font-weight: bold;">${similarity.similarity_score}% similar</span>
                                    </div>
                                    <div style="font-size: 12px; color: #a0aec0; margin-top: 5px;">
                                        Submitted: ${similarity.submission_time}
                                    </div>
                                </div>
                            `;
                        });

                        resultsHTML += `</div>`;
                    } else {
                        resultsHTML += `
                            <div style="color: var(--success); text-align: center; padding: 20px;">
                                <i class="fas fa-check-circle"></i>
                                <div>No significant plagiarism detected</div>
                            </div>
                        `;
                    }

                    plagiarismResultsContainer.innerHTML = resultsHTML;
                    plagiarismResults.style.display = 'block';
                } else {
                    throw new Error(data.error || 'Failed to check plagiarism');
                }
            } catch (error) {
                console.error('Error checking plagiarism:', error);
                plagiarismResultsContainer.innerHTML = `
                    <div style="color: var(--danger); text-align: center;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Error checking plagiarism: ${error.message}
                    </div>
                `;
                plagiarismResults.style.display = 'block';
            }
        }

        // Function to load and display received submissions in sidebar
        async function loadReceivedSubmissions() {
            try {
                const response = await fetch('/api/instructor_submissions');
                const data = await response.json();

                if (response.ok && data.submissions) {
                    receivedSubmissionsList.innerHTML = '';
                    
                    // Filter out deleted submissions
                    const activeSubmissions = data.submissions.filter(
                        submission => !deletedSubmissions.includes(submission.submission_id.toString())
                    );
                    
                    if (activeSubmissions.length > 0) {
                        // Group by assignment
                        const assignments = {};
                        activeSubmissions.forEach(submission => {
                            if (!assignments[submission.assignment_title]) {
                                assignments[submission.assignment_title] = [];
                            }
                            assignments[submission.assignment_title].push(submission);
                        });

                        Object.entries(assignments).forEach(([assignmentTitle, submissions]) => {
                            const listItem = document.createElement('div');
                            listItem.style.marginBottom = '15px';
                            listItem.style.padding = '10px';
                            listItem.style.backgroundColor = 'var(--secondary)';
                            listItem.style.borderRadius = '6px';
                            
                            listItem.innerHTML = `
                                <strong>${assignmentTitle}</strong>
                                <div style="font-size: 12px; color: #a0aec0; margin-top: 5px;">
                                    ${submissions.length} submission${submissions.length > 1 ? 's' : ''}
                                </div>
                            `;
                            receivedSubmissionsList.appendChild(listItem);
                        });
                    } else {
                        receivedSubmissionsList.innerHTML = '<div style="text-align: center; color: #a0aec0; padding: 10px;">No submissions received yet.</div>';
                    }
                } else {
                    console.error('Error loading submissions:', data.error);
                    receivedSubmissionsList.innerHTML = '<div style="color: var(--danger); text-align: center;">Error loading submissions.</div>';
                }
            } catch (error) {
                console.error('Error fetching submissions:', error);
                receivedSubmissionsList.innerHTML = '<div style="color: var(--danger); text-align: center;">Error fetching submissions.</div>';
            }
        }

        // Function to load and display leaderboard data
        async function loadLeaderboard() {
            try {
                const response = await fetch('/api/instructor_submissions');
                const data = await response.json();

                if (response.ok && data.submissions) {
                    const studentAssignmentScores = {};

                    // Filter out deleted submissions
                    const activeSubmissions = data.submissions.filter(
                        submission => !deletedSubmissions.includes(submission.submission_id.toString())
                    );

                    activeSubmissions.forEach(submission => {
                        const key = `${submission.student_name}_${submission.assignment_title}`;
                        const currentScore = submission.passed_tests / submission.total_tests;
                        const existingEntry = studentAssignmentScores[key];

                        if (!existingEntry || currentScore > (existingEntry.passed_tests / existingEntry.total_tests)) {
                            studentAssignmentScores[key] = {
                                student_name: submission.student_name,
                                assignment_title: submission.assignment_title,
                                passed_tests: submission.passed_tests,
                                total_tests: submission.total_tests,
                                submission_time: submission.submission_time
                            };
                        }
                    });

                    const leaderboardEntries = Object.values(studentAssignmentScores).sort((a, b) => {
                        if (a.assignment_title < b.assignment_title) return -1;
                        if (a.assignment_title > b.assignment_title) return 1;
                        return (b.passed_tests / b.total_tests) - (a.passed_tests / a.total_tests);
                    });
                    
                    leaderboardTableBody.innerHTML = '';

                    if (leaderboardEntries.length > 0) {
                        leaderboardEntries.forEach(entry => {
                            const row = leaderboardTableBody.insertRow();
                            row.innerHTML = `
                                <td>${entry.student_name}</td>
                                <td>${entry.assignment_title}</td>
                                <td>${entry.passed_tests}/${entry.total_tests}</td>
                                <td>${new Date(entry.submission_time).toLocaleDateString()}</td>
                            `;
                        });
                    } else {
                        leaderboardTableBody.innerHTML = '<tr><td colspan="4">No leaderboard data available.</td></tr>';
                    }

                } else {
                    console.error('Error loading leaderboard data:', data.error);
                    leaderboardTableBody.innerHTML = '<tr><td colspan="4">Error loading leaderboard data.</td></tr>';
                }
            } catch (error) {
                console.error('Error fetching leaderboard data:', error);
                leaderboardTableBody.innerHTML = '<tr><td colspan="4">Error fetching leaderboard data.</td></tr>';
            }
        }

        // Function to load and display assignments
        async function loadAssignments() {
            try {
                const response = await fetch('/api/instructor_assignments');
                const data = await response.json();

                if (response.ok) {
                    liveAssignmentsList.innerHTML = '';
                    pastAssignmentsList.innerHTML = '';
                    const now = new Date();

                    data.assignments.forEach(assignment => {
                        const dueDate = new Date(assignment.due_date);
                        const listItem = document.createElement('li');
                        listItem.style.marginBottom = '8px';
                        listItem.innerHTML = `
                            <div style="font-weight: 500;">${assignment.title}</div>
                            <div style="font-size: 12px; color: #a0aec0;">
                                Due: ${assignment.due_date} | 
                                Submissions: ${assignment.total_submissions}
                            </div>
                        `;
                        
                        if (dueDate > now) {
                            liveAssignmentsList.appendChild(listItem);
                        } else {
                            pastAssignmentsList.appendChild(listItem);
                        }
                    });
                } else {
                    console.error('Error loading assignments:', data.error);
                }
            } catch (error) {
                console.error('Error fetching assignments:', error);
            }
        }

        // Function to show delete confirmation modal
        function showDeleteConfirmation(submissionId, studentName, assignmentTitle) {
            currentSubmissionId = submissionId;
            confirmationTitle.textContent = 'Delete Submission';
            confirmationMessage.textContent = `Are you sure you want to delete the submission from ${studentName} for "${assignmentTitle}"? This action cannot be undone.`;
            confirmationModal.style.display = 'block';
        }

        // Robust delete function with fallback
        async function deleteSubmission(submissionId) {
            try {
                const response = await fetch(`/api/delete_submission/${submissionId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    // Check if response is JSON
                    try {
                        const data = await response.json();
                        showSuccessMessage(data.message || 'Submission deleted successfully');
                    } catch (jsonError) {
                        // If not JSON but response is OK, assume success
                        showSuccessMessage('Submission deleted successfully');
                    }
                    
                    // Mark as deleted and update UI
                    markSubmissionAsDeleted(submissionId);
                } else {
                    // If endpoint doesn't exist or returns error, use fallback
                    throw new Error('Delete endpoint not available');
                }
            } catch (error) {
                console.warn('Delete API not available, using client-side removal:', error);
                
                // Fallback: Remove from UI and show message
                markSubmissionAsDeleted(submissionId);
                showInfoMessage('Submission removed from view. Note: This is a client-side removal only.');
            }
        }

        function markSubmissionAsDeleted(submissionId) {
            if (!deletedSubmissions.includes(submissionId)) {
                deletedSubmissions.push(submissionId);
                localStorage.setItem('deletedSubmissions', JSON.stringify(deletedSubmissions));
            }
            removeSubmissionFromUI(submissionId);
        }

        function showSuccessMessage(message) {
            alert(message);
        }

        function showInfoMessage(message) {
            alert(message);
        }

        // Enhanced UI removal function
        function removeSubmissionFromUI(submissionId) {
            // Remove from student submissions
            const submissionElements = document.querySelectorAll(`[data-submission-id="${submissionId}"]`);
            submissionElements.forEach(element => {
                const submissionItem = element.closest('.submission-item');
                if (submissionItem) {
                    submissionItem.style.opacity = '0.5';
                    submissionItem.style.textDecoration = 'line-through';
                    
                    // Remove after animation
                    setTimeout(() => {
                        submissionItem.remove();
                        // Check if container is empty
                        if (document.querySelectorAll('.submission-item').length === 0) {
                            studentSubmissionsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #a0aec0;"><i class="fas fa-inbox"></i> No submissions received yet.</div>';
                        }
                    }, 500);
                }
            });
            
            // Reload received submissions and leaderboard
            loadReceivedSubmissions();
            loadLeaderboard();
        }

        // Initialize Flatpickr
        if (assignmentDeadlineInput) {
            flatpickr(assignmentDeadlineInput, {
                dateFormat: "Y-m-d",
                minDate: "today"
            });
        }

        // Handle New Assignment Form Submission
        if (newAssignmentForm) {
            newAssignmentForm.addEventListener('submit', async (event) => {
                event.preventDefault();

                const title = assignmentTitleInput.value.trim();
                const description = assignmentDescriptionInput.value.trim();
                const deadline = assignmentDeadlineInput.value.trim();
                const testCases = assignmentTestCasesTextarea.value.trim();

                if (!title || !description || !deadline) {
                    alert('Please fill in all assignment details.');
                    return;
                }

                const submitButton = newAssignmentForm.querySelector('.btn-submit');
                submitButton.disabled = true;
                submitButton.innerText = 'Submitting...';

                try {
                    const response = await fetch('/api/create_assignment', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ title, description, deadline, test_cases: testCases }),
                    });
                    const data = await response.json();

                    if (response.ok) {
                        alert(data.message);
                        if (liveAssignmentsList && data.assignment) {
                            const newItem = document.createElement('li');
                            newItem.style.marginBottom = '8px';
                            newItem.innerHTML = `
                                <div style="font-weight: 500;">${data.assignment.title}</div>
                                <div style="font-size: 12px; color: #a0aec0;">Due: ${data.assignment.due_date}</div>
                            `;
                            liveAssignmentsList.appendChild(newItem);
                        }
                        assignmentTitleInput.value = '';
                        assignmentDescriptionInput.value = '';
                        assignmentDeadlineInput._flatpickr.clear();
                        assignmentTestCasesTextarea.value = '';
                        loadAssignments();
                    } else {
                        alert(`Error: ${data.error || 'Failed to create assignment.'}`);
                    }
                } catch (error) {
                    console.error('Error creating assignment:', error);
                    alert('An error occurred while creating the assignment.');
                } finally {
                    submitButton.disabled = false;
                    submitButton.innerText = 'Submit Assignment';
                }
            });
        }

        if (assignmentUploadButton && assignmentUploadInput) {
            assignmentUploadButton.addEventListener('click', () => {
                assignmentUploadInput.click();
            });

            assignmentUploadInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    alert(`File selected: ${file.name}`);
                }
            });
        }

        if (getTestCasesButton && assignmentTestCasesTextarea && assignmentDescriptionInput) {
            getTestCasesButton.addEventListener('click', async () => {
                const assignmentDescription = assignmentDescriptionInput.value.trim();
                if (!assignmentDescription) {
                    alert('Please enter an Assignment Description first to get AI-suggested test cases.');
                    return;
                }

                getTestCasesButton.disabled = true;
                getTestCasesButton.innerText = 'Generating...';

                try {
                    const response = await fetch('/api/generate_test_cases', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ description: assignmentDescription }),
                    });
                    const data = await response.json();

                    if (response.ok) {
                        assignmentTestCasesTextarea.value = data.test_cases;
                    } else {
                        alert(`Error: ${data.error || 'Failed to generate test cases.'}`);
                    }
                } catch (error) {
                    console.error('Error fetching test cases:', error);
                    alert('An error occurred while generating test cases.');
                } finally {
                    getTestCasesButton.disabled = false;
                    getTestCasesButton.innerText = 'Get AI Test Cases';
                }
            });
        }

        // Load assignments for plagiarism check
        async function loadAssignmentsForPlagiarism() {
            try {
                const response = await fetch('/api/instructor_assignments');
                const data = await response.json();

                if (response.ok) {
                    assignmentSelect.innerHTML = '<option value="">Select Assignment to Check</option>';
                    data.assignments.forEach(assignment => {
                        const option = document.createElement('option');
                        option.value = assignment.id;
                        option.textContent = `${assignment.title} (${assignment.total_submissions} submissions)`;
                        assignmentSelect.appendChild(option);
                    });
                } else {
                    console.error('Error loading assignments for plagiarism check:', data.error);
                }
            } catch (error) {
                console.error('Error loading assignments for plagiarism check:', error);
                assignmentSelect.innerHTML = '<option value="">Error loading assignments</option>';
            }
        }

        // Check plagiarism for all submissions in an assignment
        checkPlagiarismBtn.addEventListener('click', async () => {
            const assignmentId = assignmentSelect.value;
            
            if (!assignmentId) {
                alert('Please select an assignment first');
                return;
            }

            checkPlagiarismBtn.disabled = true;
            checkPlagiarismBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

            try {
                const assignmentTitle = assignmentSelect.selectedOptions[0].text;
                
                plagiarismResultsContainer.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #a0aec0;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <div>Analyzing submissions for plagiarism...</div>
                    </div>
                `;
                plagiarismResults.style.display = 'block';

                const submissionsResponse = await fetch('/api/instructor_submissions');
                const submissionsData = await submissionsResponse.json();

                if (submissionsResponse.ok) {
                    // Filter out deleted submissions
                    const activeSubmissions = submissionsData.submissions.filter(
                        submission => !deletedSubmissions.includes(submission.submission_id.toString())
                    );

                    const assignmentSubmissions = activeSubmissions.filter(
                        sub => {
                            const selectedAssignmentTitle = assignmentTitle.split(' (')[0];
                            return sub.assignment_title === selectedAssignmentTitle;
                        }
                    );

                    let resultsHTML = `
                        <h4 style="color: var(--primary-light); margin-bottom: 20px;">
                            <i class="fas fa-search"></i> Plagiarism Analysis for: ${assignmentTitle.split(' (')[0]}
                        </h4>
                    `;
                    
                    let plagiarismFound = false;

                    for (const submission of assignmentSubmissions) {
                        try {
                            const response = await fetch(`/api/plagiarism/check_submission/${submission.submission_id}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });

                            const data = await response.json();

                            if (response.ok && data.similarities && data.similarities.length > 0) {
                                plagiarismFound = true;
                                resultsHTML += `
                                    <div class="plagiarism-match" style="padding: 15px; margin: 15px 0; background: rgba(239,68,68,0.1); border-radius: 8px; border-left: 4px solid var(--danger);">
                                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                            <i class="fas fa-exclamation-triangle" style="color: var(--danger); margin-right: 10px;"></i>
                                            <strong style="color: var(--light);">Potential Plagiarism Detected</strong>
                                        </div>
                                        <div style="margin-bottom: 10px;">
                                            <strong>Student:</strong> ${data.submission_checked.student_name}
                                        </div>
                                        <div style="margin-top: 15px;">
                                            <strong>Similar Submissions Found:</strong>
                                            ${data.similarities.map(sim => {
                                                let severityColor = 'var(--info)';
                                                if (sim.similarity_score > 70) severityColor = 'var(--danger)';
                                                else if (sim.similarity_score > 40) severityColor = 'var(--warning)';
                                                
                                                return `
                                                    <div style="padding: 10px; margin: 8px 0; background: rgba(255,255,255,0.05); border-radius: 6px; border-left: 3px solid ${severityColor};">
                                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                                            <strong>${sim.student_name}</strong>
                                                            <span style="color: ${severityColor}; font-weight: bold;">${sim.similarity_score}% similar</span>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                `;
                            }

                        } catch (error) {
                            console.error(`Error checking submission ${submission.submission_id}:`, error);
                        }
                    }

                    if (!plagiarismFound) {
                        resultsHTML += `
                            <div style="text-align: center; padding: 40px; color: var(--success);">
                                <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 15px;"></i>
                                <h4>No Significant Plagiarism Detected!</h4>
                                <p style="color: #a0aec0; margin-top: 10px;">All submissions analyzed successfully.</p>
                            </div>
                        `;
                    }

                    plagiarismResultsContainer.innerHTML = resultsHTML;

                } else {
                    throw new Error('Failed to fetch submissions for plagiarism check');
                }

            } catch (error) {
                console.error('Error checking plagiarism:', error);
                plagiarismResultsContainer.innerHTML = `
                    <div style="color: var(--danger); text-align: center; padding: 30px;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px;"></i>
                        <h4>Error Checking Plagiarism</h4>
                        <p>${error.message}</p>
                    </div>
                `;
            } finally {
                checkPlagiarismBtn.disabled = false;
                checkPlagiarismBtn.innerHTML = '<i class="fas fa-search"></i> Check Plagiarism';
            }
        });

        // Modal functionality
        closeModal.addEventListener('click', () => {
            codeModal.style.display = 'none';
        });

        window.addEventListener('click', (event) => {
            if (event.target === codeModal) {
                codeModal.style.display = 'none';
            }
            if (event.target === confirmationModal) {
                confirmationModal.style.display = 'none';
            }
        });

        checkPlagiarismModalBtn.addEventListener('click', () => {
            if (currentSubmissionId) {
                codeModal.style.display = 'none';
                checkSubmissionPlagiarism(currentSubmissionId);
            }
        });

        analyzeCodeBtn.addEventListener('click', async () => {
            if (currentSubmissionId) {
                try {
                    const response = await fetch('/api/instructor_submissions');
                    const data = await response.json();
                    const submission = data.submissions.find(s => s.submission_id == currentSubmissionId);
                    
                    if (submission) {
                        const aiResponse = await fetch('/api/explain_code', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ code: submission.code })
                        });
                        
                        const aiData = await aiResponse.json();
                        if (aiResponse.ok) {
                            modalOutputContent.textContent = aiData.explanation || 'No AI analysis available';
                        } else {
                            modalOutputContent.textContent = 'Error getting AI analysis';
                        }
                    }
                } catch (error) {
                    console.error('Error analyzing code:', error);
                    modalOutputContent.textContent = 'Error analyzing code';
                }
            }
        });

        // Delete submission from modal
        deleteSubmissionBtn.addEventListener('click', () => {
            if (currentSubmissionId) {
                codeModal.style.display = 'none';
                // Find the submission details for the confirmation message
                fetch('/api/instructor_submissions')
                    .then(response => response.json())
                    .then(data => {
                        if (data.submissions) {
                            const submission = data.submissions.find(s => s.submission_id == currentSubmissionId);
                            if (submission) {
                                showDeleteConfirmation(
                                    currentSubmissionId, 
                                    submission.student_name, 
                                    submission.assignment_title
                                );
                            }
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching submission details:', error);
                    });
            }
        });

        // Confirmation modal actions
        confirmDeleteBtn.addEventListener('click', () => {
            if (currentSubmissionId) {
                deleteSubmission(currentSubmissionId);
                confirmationModal.style.display = 'none';
            }
        });

        cancelDeleteBtn.addEventListener('click', () => {
            confirmationModal.style.display = 'none';
        });

        // Initialize all functionality
        loadAssignments();
        loadStudentSubmissions();
        loadReceivedSubmissions();
        loadLeaderboard();
        loadAssignmentsForPlagiarism();
    });
