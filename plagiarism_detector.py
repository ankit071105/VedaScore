import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import ast
from collections import Counter
import hashlib

class PlagiarismDetector:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            analyzer='word',
            stop_words='english',
            lowercase=True,
            max_features=1000
        )
        self.code_database = {}
    
    def preprocess_code(self, code):
        """Preprocess code by removing comments, standardizing variable names, etc."""
        # Remove single-line comments
        code = re.sub(r'#.*', '', code)
        # Remove multi-line comments
        code = re.sub(r"'''.*?'''", '', code, flags=re.DOTALL)
        code = re.sub(r'""".*?"""', '', code, flags=re.DOTALL)
        # Remove extra whitespace
        code = re.sub(r'\s+', ' ', code)
        # Standardize string literals
        code = re.sub(r'".*?"', 'STRING', code)
        code = re.sub(r"'.*?'", 'STRING', code)
        # Remove numbers
        code = re.sub(r'\b\d+\b', 'NUMBER', code)
        return code.strip()
    
    def extract_features(self, code):
        """Extract features from code for comparison."""
        # AST-based features
        try:
            tree = ast.parse(code)
            # Count different types of nodes
            node_types = [type(node).__name__ for node in ast.walk(tree)]
            node_counts = Counter(node_types)
        except:
            node_counts = {}
        
        # Basic code metrics
        lines = code.split('\n')
        line_count = len(lines)
        char_count = len(code)
        word_count = len(code.split())
        
        # Code structure features
        features = {
            'preprocessed_code': self.preprocess_code(code),
            'line_count': line_count,
            'char_count': char_count,
            'word_count': word_count,
            **node_counts
        }
        
        return features
    
    def calculate_similarity(self, code1, code2):
        """Calculate similarity between two code snippets."""
        features1 = self.extract_features(code1)
        features2 = self.extract_features(code2)
        
        # Text-based similarity using TF-IDF
        try:
            tfidf_matrix = self.vectorizer.fit_transform([
                features1['preprocessed_code'],
                features2['preprocessed_code']
            ])
            text_similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        except:
            text_similarity = 0
        
        # Structural similarity based on code metrics
        structural_similarity = self.calculate_structural_similarity(features1, features2)
        
        # Combined similarity score
        combined_similarity = 0.7 * text_similarity + 0.3 * structural_similarity
        
        return min(combined_similarity * 100, 100)  # Convert to percentage
    
    def calculate_structural_similarity(self, features1, features2):
        """Calculate structural similarity based on code metrics."""
        metrics = ['line_count', 'char_count', 'word_count']
        similarities = []
        
        for metric in metrics:
            val1 = features1.get(metric, 0)
            val2 = features2.get(metric, 0)
            
            if val1 + val2 > 0:
                similarity = 1 - abs(val1 - val2) / max(val1, val2)
                similarities.append(similarity)
        
        # AST node type similarity
        all_node_types = set(features1.keys()) | set(features2.keys())
        node_similarities = []
        
        for node_type in all_node_types:
            if node_type not in ['preprocessed_code', 'line_count', 'char_count', 'word_count']:
                count1 = features1.get(node_type, 0)
                count2 = features2.get(node_type, 0)
                
                if count1 + count2 > 0:
                    similarity = 1 - abs(count1 - count2) / max(count1, count2)
                    node_similarities.append(similarity)
        
        if node_similarities:
            similarities.extend(node_similarities)
        
        return np.mean(similarities) if similarities else 0
    
    def add_to_database(self, code, identifier):
        """Add code to the database for future comparisons."""
        code_hash = hashlib.md5(code.encode()).hexdigest()
        self.code_database[code_hash] = {
            'code': code,
            'identifier': identifier,
            'features': self.extract_features(code)
        }
    
    def check_against_database(self, code):
        """Check code against all codes in the database."""
        similarities = []
        
        for stored_code in self.code_database.values():
            similarity = self.calculate_similarity(code, stored_code['code'])
            similarities.append({
                'similarity': similarity,
                'identifier': stored_code['identifier'],
                'code': stored_code['code']
            })
        
        # Return the highest similarity
        if similarities:
            return max(similarities, key=lambda x: x['similarity'])
        else:
            return {'similarity': 0, 'identifier': 'No matches', 'code': ''}

# Singleton instance
plagiarism_detector = PlagiarismDetector()