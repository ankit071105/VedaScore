
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
        except:
            self.available = False
    
    def moderate_content(self, title, content, content_type="post"):
        """Moderate community content using AI"""
        if not self.available:
            return self._default_approval()
        
        prompt = f"""
        Analyze this {content_type} from an educational coding community:

        TITLE: {title}
        CONTENT: {content}
        TYPE: {content_type}

        Evaluate and return ONLY valid JSON:

        {{
            "status": "APPROVED" or "FLAGGED",
            "confidence": 0.85,
            "issues": ["list", "of", "issues"],
            "suggestions": ["helpful", "suggestions"],
            "moderation_notes": "brief explanation"
        }}

        Rules:
        - APPROVE educational, coding questions, project help
        - FLAG cheating requests, offensive content, spam
        - Be constructive and educational
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
            return self._default_approval()

    def _default_approval(self):
        return {
            "status": "APPROVED",
            "confidence": 0.5,
            "issues": ["AI moderation unavailable"],
            "suggestions": ["Content requires manual review"],
            "moderation_notes": "Auto-approved due to technical issues"
        }

    def analyze_plagiarism(self, code1, code2, similarity_score):
        """AI analysis for plagiarism cases"""
        if not self.available:
            return {"analysis": "AI analysis unavailable", "severity": "UNKNOWN"}
        
        prompt = f"""
        Code Similarity Analysis:
        Similarity Score: {similarity_score}%

        Analyze if this represents plagiarism or legitimate similarity.
        Consider: common algorithms, educational patterns, identical structure.

        Return JSON:
        {{
            "analysis": "detailed analysis",
            "severity": "LOW/MEDIUM/HIGH",
            "patterns_found": ["list of patterns"],
            "recommendation": "action to take"
        }}
        """

        try:
            response = self.model.generate_content(prompt)
            return json.loads(response.text)
        except:
            return {
                "analysis": "Unable to analyze with AI",
                "severity": "UNKNOWN", 
                "patterns_found": [],
                "recommendation": "Manual review required"
            }

# Global instance
ai_moderator = AIModerator(os.environ.get('GEMINI_API_KEY', "AIzaSyAJfb_OJUYSHneb288E7ecckDzxsy6Gxiw"))