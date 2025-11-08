import google.generativeai as genai
import os
import json
import re

class AIModerator:
    def __init__(self, api_key):
        self.api_key = api_key
        try:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
            self.available = True
        except Exception as e:
            print(f"AI Moderator initialization failed: {e}")
            self.available = False
    
    def moderate_content(self, title, content, content_type="post"):
        """Moderate community content using AI"""
        if not self.available:
            return self._default_approval()
        
        prompt = f"""
        Analyze this {content_type} from an educational coding community platform:

        TITLE: {title}
        CONTENT: {content}
        TYPE: {content_type}

        Evaluate based on these guidelines and return ONLY valid JSON:

        {{
            "status": "APPROVED" or "FLAGGED" or "PENDING_REVIEW",
            "confidence": 0.0 to 1.0,
            "issues": ["list of specific issues found"],
            "suggestions": ["constructive suggestions for improvement"],
            "moderation_notes": "brief explanation of decision",
            "educational_value": "low/medium/high",
            "category": "question/discussion/project_help/code_review/general"
        }}

        Community Guidelines:
        - APPROVE: Educational content, coding questions, project help, learning resources, code reviews
        - FLAGGED: Cheating requests, offensive language, spam, personal attacks, inappropriate content
        - PENDING_REVIEW: Borderline cases, complex technical discussions
        
        Be constructive and educational-focused. Consider the learning value.
        """

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean JSON response
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group()
            
            result = json.loads(result_text)
            return result
            
        except Exception as e:
            print(f"AI moderation error: {e}")
            return self._default_approval()

    def _default_approval(self):
        return {
            "status": "APPROVED",
            "confidence": 0.5,
            "issues": ["AI moderation unavailable"],
            "suggestions": ["Content requires manual review"],
            "moderation_notes": "Auto-approved due to technical issues",
            "educational_value": "medium",
            "category": "general"
        }

    def analyze_plagiarism(self, code1, code2, similarity_score):
        """AI analysis for plagiarism cases"""
        if not self.available:
            return {
                "analysis": "AI analysis unavailable", 
                "severity": "UNKNOWN",
                "patterns_found": [],
                "recommendation": "Manual review required"
            }
        
        prompt = f"""
        Code Similarity Analysis for Educational Context:
        
        Code 1:
        ```python
        {code1}
        ```
        
        Code 2:
        ```python
        {code2}
        ```
        
        Similarity Score: {similarity_score}%

        Analyze if this represents:
        - Legitimate similarity (common algorithms, educational patterns)
        - Potential plagiarism
        - Collaborative learning
        - Template-based solutions

        Return JSON analysis:
        {{
            "analysis": "detailed educational context analysis",
            "severity": "LOW/MEDIUM/HIGH/EDUCATIONAL",
            "patterns_found": ["specific code patterns identified"],
            "recommendation": "educational action to take",
            "learning_opportunity": "suggested learning focus"
        }}

        Consider educational context and common learning patterns.
        """

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group()
            return json.loads(result_text)
        except Exception as e:
            print(f"Plagiarism analysis error: {e}")
            return {
                "analysis": "Unable to analyze with AI",
                "severity": "UNKNOWN", 
                "patterns_found": [],
                "recommendation": "Manual review required",
                "learning_opportunity": "Review coding best practices"
            }

# Global instance
ai_moderator = AIModerator(os.environ.get('GEMINI_API_KEY', "AIzaSyAJfb_OJUYSHneb288E7ecckDzxsy6Gxiw"))