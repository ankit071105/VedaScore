from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
import face_recognition
import numpy as np
import base64
from PIL import Image
import io
import bcrypt
import os
from datetime import datetime
import json
import re

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'  # Change this in production
db = SQLAlchemy(app)

# Gemini AI is optional. We lazy-import and configure it when an endpoint needs it.
# If the package or a compatible Python version is not available, the app will still
# run and the endpoints that depend on Gemini will return a clear 503 error.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', "AIzaSyAJfb_OJUYSHneb288E7ecckDzxsy6Gxiw")

def get_genai():
    try:
        import google.generativeai as genai
        try:
            genai.configure(api_key=GEMINI_API_KEY)
        except Exception:
            # configuration may fail on older package versions - still return module
            pass
        return genai
    except Exception:
        return None

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    face_encoding = db.Column(db.Text, nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'User("{self.name}", "{self.email}", "{self.role}")'


class CodeFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

class Assignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    test_cases = db.Column(db.Text, nullable=True)
    
    # Relationship to user who created the assignment
    creator = db.relationship('User', backref=db.backref('created_assignments', lazy=True))

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.Text, nullable=False)
    output = db.Column(db.Text, nullable=True)
    test_results = db.Column(db.Text, nullable=True)
    passed_tests = db.Column(db.Integer, nullable=True)
    total_tests = db.Column(db.Integer, nullable=True)
    submission_time = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignment.id'), nullable=False)

    user = db.relationship('User', backref=db.backref('submissions', lazy=True))
    assignment = db.relationship('Assignment', backref=db.backref('submissions', lazy=True))
# Add these Community models after your existing models

class CommunityPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    post_type = db.Column(db.String(20), nullable=False, default='text')
    media_url = db.Column(db.String(500), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    ai_review_status = db.Column(db.String(20), nullable=False, default='pending')
    ai_feedback = db.Column(db.Text, nullable=True)
    likes_count = db.Column(db.Integer, default=0)
    comments_count = db.Column(db.Integer, default=0)
    views_count = db.Column(db.Integer, default=0)
    
    user = db.relationship('User', backref=db.backref('posts', lazy=True))

class PostComment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('community_post.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    ai_review_status = db.Column(db.String(20), nullable=False, default='pending')
    ai_feedback = db.Column(db.Text, nullable=True)
    
    user = db.relationship('User', backref=db.backref('comments', lazy=True))
    post = db.relationship('CommunityPost', backref=db.backref('comments', lazy=True))

class PostLike(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('community_post.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('likes', lazy=True))
    post = db.relationship('CommunityPost', backref=db.backref('likes', lazy=True))

class PlagiarismReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('submission.id'), nullable=False)
    similarity_score = db.Column(db.Float, nullable=False)
    matched_sources = db.Column(db.Text, nullable=True)
    ai_analysis = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    
    submission = db.relationship('Submission', backref=db.backref('plagiarism_reports', lazy=True))

@app.route('/')
def index():
    if 'user_id' in session:
        if session.get('role') == 'student':
            return redirect(url_for('student_dashboard'))
        else:
            return redirect(url_for('instructor_dashboard'))
    return render_template('login.html')

@app.route('/face_auth_page')
def face_auth_page():
    return render_template('index.html')

@app.route('/login_traditional', methods=['POST'])
def login_traditional():
    data = request.get_json()
    email = data['email']
    password = data['password']
    role = data['role']

    user = User.query.filter_by(email=email, role=role).first()

    if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        session['user_id'] = user.id
        session['name'] = user.name
        session['email'] = user.email
        session['role'] = user.role
        
        # Temporary direct login for arzoo@gmail.com instructor
        if email == 'arzoo@gmail.com' and password == '123456' and role == 'instructor':
            return jsonify({'success': True, 'message': 'Welcome Arzoo, Instructor!', 'redirect': url_for('instructor_dashboard')})

        return jsonify({'success': True, 'message': f'Welcome {user.role}, {user.name}!', 'redirect': url_for(f'{user.role}_dashboard')})
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials or role.'}), 401

@app.route('/initial_verify', methods=['POST'])
def initial_verify():
    data = request.get_json()
    image_data = data['image']

    starter = image_data.find(',')
    image_bytes = base64.b64decode(image_data[starter:])
    image = Image.open(io.BytesIO(image_bytes))
    image_np = np.array(image)

    face_encodings = face_recognition.face_encodings(image_np)

    if len(face_encodings) > 0:
        unknown_face_encoding = face_encodings[0]

        users_in_db = User.query.filter_by(role='student').all()
        found_user = None

        for user_data in users_in_db:
            known_face_encoding = np.array(eval(user_data.face_encoding))
            matches = face_recognition.compare_faces([known_face_encoding], unknown_face_encoding)
            if True in matches:
                session['user_id'] = user_data.id
                session['name'] = user_data.name
                session['email'] = user_data.email
                session['role'] = user_data.role
                found_user = user_data.email
                found_name = user_data.name
                break

        if found_user:
            return jsonify({'recognized': True, 'email': found_user, 'name': found_name, 'redirect': url_for(f'{user_data.role}_dashboard')})
        else:
            return jsonify({'recognized': False, 'message': 'Face not recognized or not a student.'}), 401
    else:
        return jsonify({'message': 'No face found in the image.'}), 400

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data['email']
    password = data['password']
    name = data['name']
    image_data = data['image']

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Email already registered.'}), 409

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    starter = image_data.find(',')
    image_bytes = base64.b64decode(image_data[starter:])
    image = Image.open(io.BytesIO(image_bytes))
    image_np = np.array(image)

    face_encodings = face_recognition.face_encodings(image_np)

    if len(face_encodings) > 0:
        known_face_encoding = face_encodings[0].tolist()
        new_user = User(name=name, email=email, password_hash=hashed_password, face_encoding=str(known_face_encoding), role='student')
        db.session.add(new_user)
        db.session.commit()
        
        session['user_id'] = new_user.id
        session['name'] = new_user.name
        session['email'] = new_user.email
        session['role'] = new_user.role
        
        return jsonify({'message': 'Registration successful!'})
    else:
        return jsonify({'message': 'No face found in the image.'}), 400

@app.route('/student_dashboard')
def student_dashboard():
    if 'user_id' not in session or session.get('role') != 'student':
        return redirect(url_for('index'))
    
    user = User.query.get(session['user_id'])
    
    # Check if user exists
    if not user:
        session.clear()
        return redirect(url_for('index'))
    
    all_assignments = Assignment.query.order_by(Assignment.due_date.desc()).all()
    code_files = CodeFile.query.filter_by(user_id=session['user_id']).all()
    
    return render_template('student_dashboard.html', 
                         user=user, 
                         assignments=all_assignments,
                         code_files=code_files)

@app.route('/api/instructor_assignments', methods=['GET'])
def instructor_assignments():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401

    all_assignments = Assignment.query.order_by(Assignment.due_date.desc()).all()
    assignments_data = []

    for assignment in all_assignments:
        submissions = Submission.query.filter_by(assignment_id=assignment.id).all()
        total_submissions = len(submissions)
        passed_submissions = sum(1 for s in submissions if s.passed_tests == s.total_tests and s.total_tests > 0)
        
        # FIX: Handle empty or invalid test_cases JSON
        test_cases_data = []
        if assignment.test_cases:
            try:
                test_cases_data = json.loads(assignment.test_cases)
            except (json.JSONDecodeError, TypeError):
                # If JSON is invalid, provide empty list
                test_cases_data = []
        
        assignments_data.append({
            'id': assignment.id,
            'title': assignment.title,
            'description': assignment.description,
            'due_date': assignment.due_date.strftime('%Y-%m-%d'),
            'total_submissions': total_submissions,
            'passed_submissions': passed_submissions,
            'test_cases': test_cases_data  # Use the safely parsed data
        })
    
    return jsonify({'assignments': assignments_data})


@app.route('/instructor_dashboard')
def instructor_dashboard():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return redirect(url_for('index'))
    
    user = User.query.get(session['user_id'])
    
    # Check if user exists
    if not user:
        session.clear()
        return redirect(url_for('index'))
    
    return render_template('instructor_dashboard.html', user=user)

@app.route('/api/instructor_submissions', methods=['GET'])
def instructor_submissions():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401

    instructor_id = session['user_id']
    
    # Get all assignments created by the current instructor
    instructor_assignments = Assignment.query.filter_by(created_by=instructor_id).all()
    instructor_assignment_ids = [assignment.id for assignment in instructor_assignments]

    # Get all submissions for these assignments
    all_submissions = Submission.query.filter(Submission.assignment_id.in_(instructor_assignment_ids)).order_by(Submission.submission_time.desc()).all()

    submissions_data = []
    for submission in all_submissions:
        student = User.query.get(submission.user_id)
        assignment = Assignment.query.get(submission.assignment_id)
        
        if student and assignment:
            # Parse test results for detailed analysis
            test_results = []
            if submission.test_results:
                try:
                    test_results = json.loads(submission.test_results)
                except (json.JSONDecodeError, TypeError):
                    test_results = []
            
            submissions_data.append({
                'submission_id': submission.id,
                'student_name': student.name,
                'student_email': student.email,
                'assignment_title': assignment.title,
                'assignment_id': assignment.id,
                'submission_time': submission.submission_time.strftime('%Y-%m-%d %H:%M:%S'),
                'passed_tests': submission.passed_tests,
                'total_tests': submission.total_tests,
                'code': submission.code,  # Include the actual code
                'output': submission.output,
                'test_results': test_results,  # Include detailed test results
                'success_rate': round((submission.passed_tests / submission.total_tests * 100), 2) if submission.total_tests > 0 else 0
            })
    
    return jsonify({'submissions': submissions_data})


@app.route('/assignment/<int:assignment_id>')
def assignment_detail(assignment_id):
    if 'user_id' not in session or session.get('role') != 'student':
        return redirect(url_for('index'))

    assignment = Assignment.query.get_or_404(assignment_id)
    return render_template('assignment_detail.html', assignment=assignment)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

# Gemini AI API Routes
@app.route('/api/run_code', methods=['POST'])
def run_code():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    
    # ADD PROMPT FOR CODE EXECUTION
    prompt = f"""Analyze and execute this code mentally. Provide the expected output and any execution results.
    
    Code:
    {code}
    
    Provide only the execution output and results. If there are errors, mention them clearly."""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'output': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/explain_code', methods=['POST'])
def explain_code():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    
    # ADD PROMPT FOR CODE EXPLANATION
    prompt = f"""Explain this code in detail, including:
    1. What the code does
    2. How it works step by step
    3. Key programming concepts used
    4. Time and space complexity if applicable
    
    Code:
    {code}
    
    Provide a comprehensive but clear explanation."""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'explanation': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_errors', methods=['POST'])
def check_errors():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    
    # ADD PROMPT FOR ERROR CHECKING
    prompt = f"""Analyze this code for errors and issues. Check for:
    1. Syntax errors
    2. Logical errors
    3. Potential runtime errors
    4. Code style and best practices
    5. Security vulnerabilities
    
    Code:
    {code}
    
    Provide a detailed error report with specific line numbers and suggestions for fixes."""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'errors': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/convert_code', methods=['POST'])
def convert_code():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    target_language = data.get('target_language', 'JavaScript')
    
    # ADD PROMPT FOR CODE CONVERSION
    prompt = f"""Convert the following code to {target_language}. Maintain the same functionality and logic.
    
    Original Code:
    {code}
    
    Provide only the converted code with minimal explanations."""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'converted_code': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/optimize_code', methods=['POST'])
def optimize_code():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    
    # ADD PROMPT FOR CODE OPTIMIZATION
    prompt = f"""Optimize this code for better performance, readability, and efficiency. Provide the optimized version with explanations of improvements.
    
    Code:
    {code}
    
    Focus on:
    1. Algorithmic improvements
    2. Memory usage optimization
    3. Time complexity reduction
    4. Code readability
    5. Best practices implementation"""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'optimized_code': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/debug_code', methods=['POST'])
def debug_code():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    
    # ADD PROMPT FOR DEBUGGING
    prompt = f"""Debug this code and identify any issues. Provide:
    1. List of bugs found
    2. Step-by-step debugging process
    3. Fixed code version
    4. Explanation of what was wrong and how it was fixed
    
    Code:
    {code}"""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'debug_info': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/check_plagiarism', methods=['POST'])
def check_plagiarism():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    code = data.get('code', '')
    
    # This would integrate with the ML plagiarism detection
    # For now, using Gemini to analyze similarity
    prompt = f"""Analyze this code for potential plagiarism by checking:
    1. Code structure similarity with common solutions
    2. Variable naming patterns
    3. Algorithm implementation uniqueness
    4. Comment style and placement
    
    Code:
    {code}
    
    Provide a plagiarism assessment with similarity percentage estimate and originality analysis."""
    
    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        # Simulate ML plagiarism detection (would be replaced with actual ML model)
        plagiarism_score = 15  # This would come from ML model
        
        return jsonify({
            'plagiarism_analysis': response.text,
            'similarity_score': plagiarism_score,
            'originality_score': 100 - plagiarism_score
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# File management routes
@app.route('/api/save_file', methods=['POST'])
def save_file():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    filename = data.get('filename', '')
    content = data.get('content', '')
    
    existing_file = CodeFile.query.filter_by(filename=filename, user_id=session['user_id']).first()
    
    if existing_file:
        existing_file.content = content
        existing_file.updated_at = datetime.utcnow()
    else:
        new_file = CodeFile(filename=filename, content=content, user_id=session['user_id'])
        db.session.add(new_file)
    
    db.session.commit()
    
    return jsonify({'message': 'File saved successfully!'})

@app.route('/api/get_files', methods=['GET'])
def get_files():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    files = CodeFile.query.filter_by(user_id=session['user_id']).all()
    file_list = [{'id': f.id, 'filename': f.filename, 'updated_at': f.updated_at} for f in files]
    
    return jsonify({'files': file_list})

@app.route('/api/load_file/<int:file_id>', methods=['GET'])
def load_file(file_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    file = CodeFile.query.filter_by(id=file_id, user_id=session['user_id']).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({'filename': file.filename, 'content': file.content})

@app.route('/api/generate_test_cases', methods=['POST'])
def generate_test_cases():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    assignment_description = data.get('description', '')

    if not assignment_description:
        return jsonify({'error': 'Assignment description is required to generate test cases.'}), 400

    prompt = f"""Generate exactly 7 test cases for the following assignment. 
    Provide ONLY the test cases in this exact format, with no additional explanations, notes, or commentary:

    Test Case 1: [input_value], [expected_output_value]
    Test Case 2: [input_value], [expected_output_value]
    Test Case 3: [input_value], [expected_output_value]
    Test Case 4: [input_value], [expected_output_value]
    Test Case 5: [input_value], [expected_output_value]
    Test Case 6: [input_value], [expected_output_value]
    Test Case 7: [input_value], [expected_output_value]

    Assignment Description: {assignment_description}

    Include edge cases and typical scenarios. Do not add any notes, warnings, or explanations.
    """

    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'test_cases': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/submission_analytics', methods=['GET'])
def submission_analytics():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401

    # Mock data for demonstration
    mock_data = {
        'labels': ['Assignment 1', 'Assignment 2', 'Assignment 3', 'Assignment 4'],
        'submissions': [10, 15, 8, 12],
        'passed_test_cases': [7, 12, 6, 9]
    }
    return jsonify(mock_data)

@app.route('/api/run_assignment_code', methods=['POST'])
def run_assignment_code():
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    code = data.get('code', '')
    assignment_id = data.get('assignment_id')
    is_submission = data.get('is_submission', False) # New: flag to determine if it's a submission

    if not code or not assignment_id:
        return jsonify({'error': 'Code and assignment ID are required.'}), 400

    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return jsonify({'error': 'Assignment not found.'}), 404

    # Only run tests and save submission if it's an actual submission
    if not is_submission:
        import sys
        from io import StringIO
        
        old_stdout = sys.stdout
        try:
            redirected_output = StringIO()
            sys.stdout = redirected_output

            exec_globals = {}
            exec_locals = {'input_data': '', 'print': sys.stdout.write} # No input_data for simple run

            exec(code, exec_globals, exec_locals)

            actual_output = redirected_output.getvalue().strip()
            sys.stdout = old_stdout  # Restore stdout

            if not actual_output:
                actual_output = "Code executed successfully (no output)."

            return jsonify({'output': actual_output})

        except SyntaxError as e:
            sys.stdout = old_stdout
            return jsonify({'output': f"Syntax Error: {str(e)}"})
        except Exception as e:
            sys.stdout = old_stdout
            return jsonify({'output': f"Execution Error: {str(e)}"})

    # If it is a submission, proceed with test cases and saving
    if not assignment.test_cases:
        return jsonify({'error': 'No test cases found for this assignment.'}), 400
    
    try:
        test_cases = json.loads(assignment.test_cases)
    except (json.JSONDecodeError, TypeError) as e:
        return jsonify({'error': f'Invalid test cases format: {str(e)}'}), 400
    
    if not test_cases or len(test_cases) == 0:
        return jsonify({'error': 'No test cases available for this assignment.'}), 400
    import sys
    from io import StringIO
    
    results = []
    overall_output = ""
    passed_count = 0

    for i, test_case in enumerate(test_cases):
        input_data = test_case.get('input', '')
        expected_output = str(test_case.get('expected_output', ''))

        old_stdout = sys.stdout
        try:
            redirected_output = StringIO()
            sys.stdout = redirected_output

            exec_globals = {}
            exec_locals = {'input_data': input_data, 'print': sys.stdout.write}

            # Execute the student's code
            exec(code, exec_globals, exec_locals)

            actual_output = redirected_output.getvalue().strip()
            sys.stdout = old_stdout  # Restore stdout

            is_passed = (actual_output == expected_output)
            if is_passed:
                passed_count += 1

            results.append({
                'case_num': i + 1,
                'input': input_data,
                'expected': expected_output,
                'actual': actual_output,
                'passed': is_passed
            })
            overall_output += f"Test Case {i+1} (Input: {input_data}):\nExpected: {expected_output}\nActual: {actual_output}\nStatus: {'PASSED' if is_passed else 'FAILED'}\n\n"

        except Exception as e:
            sys.stdout = old_stdout  # Restore stdout in case of error
            actual_output = f"Execution Error: {str(e)}"
            results.append({
                'case_num': i + 1,
                'input': input_data,
                'expected': expected_output,
                'actual': actual_output,
                'passed': False
            })
            overall_output += f"Test Case {i+1} (Input: {input_data}):\nExecution Error: {str(e)}\nStatus: FAILED\n\n"
            
    # Save submission
    new_submission = Submission(
        code=code,
        output=overall_output,
        test_results=json.dumps(results),
        passed_tests=passed_count,
        total_tests=len(test_cases),
        user_id=session['user_id'],
        assignment_id=assignment_id
    )
    db.session.add(new_submission)
    db.session.commit()

    return jsonify({
        'output': overall_output,
        'test_results': results,
        'passed_count': passed_count,
        'total_tests': len(test_cases)
    })

@app.route('/api/get_ai_feedback', methods=['POST'])
def get_ai_feedback():
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    code = data.get('code', '')
    assignment_id = data.get('assignment_id')
    assignment_description = data.get('assignment_description', '')

    if not code or not assignment_id or not assignment_description:
        return jsonify({'error': 'Code, assignment ID, and description are required.'}), 400

    prompt = f"""As a senior programming instructor, provide detailed feedback on the following student's code for an assignment. Focus on correctness, efficiency, style, and best practices. Suggest specific improvements. Ensure the feedback is encouraging and constructive.

Assignment Description: {assignment_description}

Student's Code:
```python
{code}
```

Provide your feedback in a well-formatted markdown, highlighting key areas and actionable suggestions."""

    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'feedback': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_imp_quiz', methods=['POST'])
def get_imp_quiz():
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    assignment_id = data.get('assignment_id')
    assignment_description = data.get('assignment_description', '')

    if not assignment_id or not assignment_description:
        return jsonify({'error': 'Assignment ID and description are required.'}), 400

    prompt = f"""As a seasoned educator, generate a list of important exam-style questions and a short, interactive quiz (3-5 multiple-choice questions) related to the following assignment description. The quiz should be directly actionable by the student.

Assignment Description: {assignment_description}

Format your response as follows:

### Important Exam Questions
1. Question 1
2. Question 2

### Quiz
1. Question 1 (Multiple Choice)
   a) Option A
   b) Option B
   c) Option C
   Correct Answer: [a/b/c]

Provide the content in well-formatted markdown."""

    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'content': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_ai_feedback_dashboard', methods=['POST'])
def get_ai_feedback_dashboard():
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    assignments_description = data.get('assignments_description', '')

    if not assignments_description:
        return jsonify({'error': 'Assignment descriptions are required to generate dashboard feedback.'}), 400

    prompt = f"""As a helpful AI coding assistant, provide **short, precise, and actionable general tips** based on the following collection of assignment descriptions. Focus on common pitfalls, good coding practices, or general strategies that would be beneficial for a student working on these types of assignments. Keep the feedback to 2-3 concise points.

Collection of Assignment Descriptions:
{assignments_description}

Provide your feedback in a well-formatted markdown, offering actionable advice."""

    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'feedback': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_imp_quiz_dashboard', methods=['POST'])
def get_imp_quiz_dashboard():
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    assignments_description = data.get('assignments_description', '')

    if not assignments_description:
        return jsonify({'error': 'Assignment descriptions are required to generate dashboard quiz.'}), 400

    prompt = f"""As a helpful AI educator, generate a short, interactive quiz (3-5 multiple-choice questions) based on the following collection of assignment descriptions. The quiz should test fundamental concepts and problem-solving relevant to these assignments.

Collection of Assignment Descriptions:
{assignments_description}

Format your response for EACH question as follows:

### Question [Number]
Question text?
   a) Option A
   b) Option B
   c) Option C
Correct Answer: [a/b/c]

Ensure each option (a, b, c, etc.) is on a new line. Do NOT include the "Quiz Questions" heading.

Provide the content in well-formatted markdown."""

    genai = get_genai()
    if not genai:
        return jsonify({'error': 'Gemini AI not configured or google.generativeai not installed.'}), 503

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return jsonify({'content': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get_submission/<int:assignment_id>', methods=['GET'])
def get_submission(assignment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    submission = Submission.query.filter_by(
        user_id=session['user_id'],
        assignment_id=assignment_id
    ).order_by(Submission.submission_time.desc()).first()

    if submission:
        return jsonify({
            'submission': {
                'id': submission.id,
                'code': submission.code,
                'output': submission.output,
                'test_results': submission.test_results,
                'passed_tests': submission.passed_tests,
                'total_tests': submission.total_tests,
                'submission_time': submission.submission_time.strftime('%Y-%m-%d %H:%M:%S')
            }
        })
    else:
        return jsonify({'submission': None}), 404

@app.route('/api/assignment/<int:assignment_id>', methods=['GET'])
def api_assignment_detail(assignment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    assignment = Assignment.query.get_or_404(assignment_id)
    
    return jsonify({
        'assignment': {
            'id': assignment.id,
            'title': assignment.title,
            'description': assignment.description,
            'due_date': assignment.due_date.strftime('%Y-%m-%d %H:%M:%S'),
            'test_cases': assignment.test_cases
        }
    })


@app.route('/api/student_assignments', methods=['GET'])
def student_assignments_api():
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401

    all_assignments = Assignment.query.order_by(Assignment.due_date.desc()).all()
    assignments_data = []

    for assignment in all_assignments:
        # Check if the current student has submitted this assignment successfully
        submission = Submission.query.filter_by(
            user_id=session['user_id'],
            assignment_id=assignment.id
        ).filter(Submission.passed_tests == Submission.total_tests, Submission.total_tests > 0).first()

        is_submitted = submission is not None

        assignments_data.append({
            'id': assignment.id,
            'title': assignment.title,
            'description': assignment.description, # Added description to be used in frontend
            'due_date': assignment.due_date.strftime('%Y-%m-%d %H:%M:%S'), # Include time for full date object in JS
            'is_submitted': is_submitted, # Include submission status
            'passed_tests': submission.passed_tests if submission else 0, # Include passed tests count
            'total_tests': submission.total_tests if submission else 0 # Include total tests count
        })
    
    return jsonify({'assignments': assignments_data})

@app.route('/api/create_assignment', methods=['POST'])
def create_assignment():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json()
    title = data.get('title', '')
    description = data.get('description', '')
    deadline_str = data.get('deadline', '')
    test_cases_str = data.get('test_cases', '')  # May be JSON or free-form text from the instructor UI

    def _normalize_test_cases(raw: str):
        """Try to convert various instructor-provided test case formats into
        a JSON-serializable list of objects with keys 'input' and 'expected_output'.

        Accepts:
        - A JSON array string like: [{"input": "...", "expected_output": "..."}, ...]
        - A string with single quotes instead of double quotes
        - AI-generated plain text with lines like: "Test Case 1: input, expected"
        - A few other simple comma-separated formats
        """
        if not raw or raw.strip() == '[]':
            return []

        # Try parsing as JSON first
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                # Ensure each item has expected keys
                normalized = []
                for item in parsed:
                    if isinstance(item, dict):
                        inp = item.get('input') or item.get('input_data') or item.get('inputValue')
                        exp = item.get('expected_output') or item.get('expected') or item.get('expectedOutput')
                        normalized.append({'input': inp if inp is not None else '', 'expected_output': exp if exp is not None else ''})
                    else:
                        # Non-dict items, convert to string
                        normalized.append({'input': str(item), 'expected_output': ''})
                return normalized
        except Exception:
            pass

        # Try quick fix for single quotes (common when instructors paste Python repr)
        try:
            fixed = raw.replace("'", '"')
            parsed = json.loads(fixed)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

        # Parse AI-generated lines like: "Test Case 1: [input], [expected_output]"
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
        test_cases = []
        for line in lines:
            # Attempt to find something after colon
            m = re.search(r":\s*(.*)$", line)
            content = m.group(1).strip() if m else line

            # If content contains a comma, split into input and expected
            if "," in content:
                parts = [p.strip() for p in content.split(",", 1)]
                inp, exp = parts[0], parts[1]
            else:
                # If no comma, treat the whole content as input and empty expected
                inp, exp = content, ''

            # Remove surrounding brackets if present
            inp = inp.strip()
            exp = exp.strip()
            if inp.startswith('[') and inp.endswith(']'):
                inp = inp[1:-1].strip()
            if exp.startswith('[') and exp.endswith(']'):
                exp = exp[1:-1].strip()

            test_cases.append({'input': inp, 'expected_output': exp})

        return test_cases

    if not all([title, description, deadline_str]):
        return jsonify({'error': 'Missing assignment details.'}), 400

    try:
        deadline = datetime.strptime(deadline_str, '%Y-%m-%d')
    except ValueError:
        return jsonify({'error': 'Invalid deadline format. Please use YYYY-MM-DD.'}), 400

    try:
        # Normalize the test cases before saving to ensure student view can parse them
        normalized = _normalize_test_cases(test_cases_str)
        test_cases_json = json.dumps(normalized)

        new_assignment = Assignment(
            title=title,
            description=description,
            due_date=deadline,
            created_by=session['user_id'],
            test_cases=test_cases_json
        )
        db.session.add(new_assignment)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Assignment created successfully!',
            'assignment': {
                'id': new_assignment.id,
                'title': new_assignment.title,
                'due_date': new_assignment.due_date.strftime('%Y-%m-%d')
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/community')
def community():
    if 'user_id' not in session:
        return redirect(url_for('index'))
    
    user = User.query.get(session['user_id'])
    
    # Check if user exists
    if not user:
        session.clear()
        return redirect(url_for('index'))
    
    posts = CommunityPost.query.filter_by(ai_review_status='APPROVED').order_by(CommunityPost.created_at.desc()).all()
    
    return render_template('community.html', user=user, posts=posts)

@app.route('/api/community/posts', methods=['GET'])
def get_community_posts():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    posts = CommunityPost.query.filter_by(ai_review_status='APPROVED')\
                              .order_by(CommunityPost.created_at.desc())\
                              .paginate(page=page, per_page=per_page, error_out=False)
    
    posts_data = []
    for post in posts.items:
        user_liked = PostLike.query.filter_by(user_id=session['user_id'], post_id=post.id).first() is not None
        
        posts_data.append({
            'id': post.id,
            'title': post.title,
            'content': post.content,
            'post_type': post.post_type,
            'media_url': post.media_url,
            'user_name': post.user.name,
            'created_at': post.created_at.strftime('%Y-%m-%d %H:%M'),
            'likes_count': post.likes_count,
            'comments_count': post.comments_count,
            'user_liked': user_liked,
            'user_avatar': post.user.name[0].upper()
        })
    
    return jsonify({
        'posts': posts_data,
        'has_next': posts.has_next,
        'has_prev': posts.has_prev
    })

@app.route('/api/community/posts', methods=['POST'])
def create_community_post():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    post_type = data.get('post_type', 'text')
    
    if not title or not content:
        return jsonify({'error': 'Title and content are required'}), 400
    
    # AI Moderation - placeholder implementation
    # In a real implementation, you would call your AI moderation service here
    moderation_result = {
        'status': 'APPROVED',
        'reason': 'Auto-approved for demo'
    }
    
    new_post = CommunityPost(
        title=title,
        content=content,
        post_type=post_type,
        user_id=session['user_id'],
        ai_review_status=moderation_result['status'],
        ai_feedback=json.dumps(moderation_result)
    )
    
    db.session.add(new_post)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Post created successfully!',
        'post_id': new_post.id,
        'moderation_status': moderation_result['status']
    })

@app.route('/api/community/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    post = CommunityPost.query.get_or_404(post_id)
    existing_like = PostLike.query.filter_by(user_id=session['user_id'], post_id=post_id).first()
    
    if existing_like:
        db.session.delete(existing_like)
        post.likes_count -= 1
        liked = False
    else:
        new_like = PostLike(user_id=session['user_id'], post_id=post_id)
        db.session.add(new_like)
        post.likes_count += 1
        liked = True
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'liked': liked,
        'likes_count': post.likes_count
    })

@app.route('/api/community/posts/<int:post_id>/comments', methods=['POST'])
def create_comment(post_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    content = data.get('content', '').strip()
    
    if not content:
        return jsonify({'error': 'Comment content is required'}), 400
    
    post = CommunityPost.query.get_or_404(post_id)
    
    # AI Moderation for comment - placeholder implementation
    moderation_result = {
        'status': 'APPROVED',
        'reason': 'Auto-approved for demo'
    }
    
    new_comment = PostComment(
        content=content,
        user_id=session['user_id'],
        post_id=post_id,
        ai_review_status=moderation_result['status'],
        ai_feedback=json.dumps(moderation_result)
    )
    
    post.comments_count += 1
    
    db.session.add(new_comment)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Comment added successfully!',
        'comment': {
            'id': new_comment.id,
            'content': content,
            'user_name': new_comment.user.name,
            'user_avatar': new_comment.user.name[0].upper(),
            'created_at': new_comment.created_at.strftime('%Y-%m-%d %H:%M')
        }
    })





# Plagiarism Check Routes
@app.route('/api/plagiarism/check_submission/<int:submission_id>', methods=['POST'])
def check_submission_plagiarism(submission_id):
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401
    
    submission = Submission.query.get_or_404(submission_id)
    
    # Get all other submissions for the same assignment
    other_submissions = Submission.query.filter(
        Submission.assignment_id == submission.assignment_id,
        Submission.id != submission_id
    ).all()
    
    similarities = []
    
    for other_sub in other_submissions:
        similarity = plagiarism_detector.calculate_similarity(submission.code, other_sub.code)
        
        if similarity > 25:  # Report similarities above 25%
            student = User.query.get(other_sub.user_id)
            ai_analysis = ai_moderator.analyze_plagiarism(submission.code, other_sub.code, similarity)
            
            similarities.append({
                'similarity_score': similarity,
                'student_name': student.name,
                'student_email': student.email,
                'submission_id': other_sub.id,
                'submission_time': other_sub.submission_time.strftime('%Y-%m-%d %H:%M'),
                'ai_analysis': ai_analysis
            })
    
    # Create plagiarism report
    if similarities:
        highest_similarity = max(similarities, key=lambda x: x['similarity_score'])
        
        plagiarism_report = PlagiarismReport(
            submission_id=submission_id,
            similarity_score=highest_similarity['similarity_score'],
            matched_sources=json.dumps(similarities),
            ai_analysis=json.dumps(highest_similarity['ai_analysis']),
            status='reviewed'
        )
        
        db.session.add(plagiarism_report)
        db.session.commit()
    
    return jsonify({
        'similarities': similarities,
        'submission_checked': {
            'id': submission.id,
            'student_name': submission.user.name,
            'assignment_title': submission.assignment.title
        }
    })

@app.route('/api/plagiarism/reports', methods=['GET'])
def get_plagiarism_reports():
    if 'user_id' not in session or session.get('role') != 'instructor':
        return jsonify({'error': 'Unauthorized'}), 401
    
    reports = PlagiarismReport.query.join(Submission).join(Assignment)\
                                   .order_by(PlagiarismReport.created_at.desc()).all()
    
    reports_data = []
    for report in reports:
        reports_data.append({
            'id': report.id,
            'submission_id': report.submission_id,
            'student_name': report.submission.user.name,
            'assignment_title': report.submission.assignment.title,
            'similarity_score': report.similarity_score,
            'created_at': report.created_at.strftime('%Y-%m-%d %H:%M'),
            'status': report.status,
            'ai_analysis': json.loads(report.ai_analysis) if report.ai_analysis else {}
        })
    
    return jsonify({'reports': reports_data})




# Add sample community posts
def initialize_sample_data():
    """Initialize sample data only if tables are empty"""
    with app.app_context():
        # Add sample community posts
        if not CommunityPost.query.first():
            sample_posts = [
                CommunityPost(
                    title="Best way to learn Python?",
                    content="I'm just starting with Python programming. What are the best resources and projects to work on as a beginner? Any tips would be greatly appreciated!",
                    user_id=1,
                    ai_review_status="APPROVED",
                    likes_count=5,
                    comments_count=3
                ),
                # ... other posts
            ]
            db.session.add_all(sample_posts)
            db.session.commit()
            print("Sample community posts created")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # ... your other initialization code
        
        # Call the function to initialize sample data
        initialize_sample_data()
            
    app.run(debug=True, port=5001)