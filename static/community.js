
        let currentPage = 1;
        let loading = false;
        let hasMore = true;

        // DOM Elements
        const postsFeed = document.getElementById('posts-feed');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const createPostForm = document.getElementById('create-post-form');

        // Load posts
        async function loadPosts(page = 1, append = false) {
            if (loading) return;
            
            loading = true;
            if (!append) {
                postsFeed.innerHTML = '<div style="text-align: center; padding: 40px; color: #a0aec0;"><i class="fas fa-spinner fa-spin"></i> Loading posts...</div>';
            }

            try {
                const response = await fetch(`/api/community/posts?page=${page}`);
                const data = await response.json();

                if (response.ok) {
                    if (!append) {
                        postsFeed.innerHTML = '';
                    }

                    if (data.posts.length === 0 && page === 1) {
                        postsFeed.innerHTML = `
                            <div style="text-align: center; padding: 40px; color: #a0aec0;">
                                <i class="fas fa-comments" style="font-size: 48px; margin-bottom: 20px;"></i>
                                <h3>No posts yet</h3>
                                <p>Be the first to start a discussion!</p>
                            </div>
                        `;
                        return;
                    }

                    data.posts.forEach(post => {
                        const postElement = createPostElement(post);
                        postsFeed.appendChild(postElement);
                    });

                    hasMore = data.has_next;
                    loadMoreBtn.style.display = hasMore ? 'block' : 'none';
                    currentPage = page;

                } else {
                    throw new Error(data.error || 'Failed to load posts');
                }
            } catch (error) {
                console.error('Error loading posts:', error);
                if (!append) {
                    postsFeed.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--danger);">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Error loading posts: ${error.message}</p>
                        </div>
                    `;
                }
            } finally {
                loading = false;
            }
        }

        // Create post element
        function createPostElement(post) {
            const postDiv = document.createElement('div');
            postDiv.className = 'post-card';
            postDiv.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar">${post.user_avatar}</div>
                    <div class="post-user-info">
                        <div class="post-user-name">${post.user_name}</div>
                        <div class="post-time">${post.created_at}</div>
                    </div>
                </div>
                <div class="post-title">${post.title}</div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <button class="post-action like-btn ${post.user_liked ? 'liked' : ''}" data-post-id="${post.id}">
                        <i class="fas fa-heart"></i>
                        <span class="like-count">${post.likes_count}</span>
                    </button>
                    <button class="post-action comment-btn" data-post-id="${post.id}">
                        <i class="fas fa-comment"></i>
                        <span class="comment-count">${post.comments_count}</span>
                    </button>
                </div>
                <div class="comments-section" id="comments-${post.id}" style="display: none;">
                    <div class="comment-form">
                        <input type="text" class="comment-input" placeholder="Write a comment..." data-post-id="${post.id}">
                        <button class="comment-submit" data-post-id="${post.id}">Post</button>
                    </div>
                    <div class="comments-list" id="comments-list-${post.id}"></div>
                </div>
            `;

            // Add event listeners
            const likeBtn = postDiv.querySelector('.like-btn');
            const commentBtn = postDiv.querySelector('.comment-btn');
            const commentInput = postDiv.querySelector('.comment-input');
            const commentSubmit = postDiv.querySelector('.comment-submit');

            likeBtn.addEventListener('click', () => handleLike(post.id, likeBtn));
            commentBtn.addEventListener('click', () => toggleComments(post.id));
            commentSubmit.addEventListener('click', () => handleComment(post.id, commentInput));

            return postDiv;
        }

        // Handle like
        async function handleLike(postId, likeBtn) {
            try {
                const response = await fetch(`/api/community/posts/${postId}/like`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.ok) {
                    const likeCount = likeBtn.querySelector('.like-count');
                    likeCount.textContent = data.likes_count;
                    
                    if (data.liked) {
                        likeBtn.classList.add('liked');
                    } else {
                        likeBtn.classList.remove('liked');
                    }
                } else {
                    alert('Error liking post: ' + data.error);
                }
            } catch (error) {
                console.error('Error liking post:', error);
                alert('Error liking post');
            }
        }

        // Toggle comments
        async function toggleComments(postId) {
            const commentsSection = document.getElementById(`comments-${postId}`);
            const commentsList = document.getElementById(`comments-list-${postId}`);

            if (commentsSection.style.display === 'none') {
                // Load comments
                try {
                    const response = await fetch(`/api/community/posts/${postId}/comments`);
                    const data = await response.json();

                    if (response.ok) {
                        commentsList.innerHTML = '';
                        
                        if (data.comments.length === 0) {
                            commentsList.innerHTML = '<div style="text-align: center; color: #a0aec0; padding: 20px;">No comments yet</div>';
                        } else {
                            data.comments.forEach(comment => {
                                const commentDiv = document.createElement('div');
                                commentDiv.className = 'comment';
                                commentDiv.innerHTML = `
                                    <div class="comment-avatar">${comment.user_avatar}</div>
                                    <div class="comment-content">
                                        <div class="comment-user">${comment.user_name}</div>
                                        <div class="comment-text">${comment.content}</div>
                                        <div class="comment-time">${comment.created_at}</div>
                                    </div>
                                `;
                                commentsList.appendChild(commentDiv);
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error loading comments:', error);
                    commentsList.innerHTML = '<div style="color: var(--danger);">Error loading comments</div>';
                }

                commentsSection.style.display = 'block';
            } else {
                commentsSection.style.display = 'none';
            }
        }

        // Handle comment
        async function handleComment(postId, commentInput) {
            const content = commentInput.value.trim();
            
            if (!content) {
                alert('Please enter a comment');
                return;
            }

            try {
                const response = await fetch(`/api/community/posts/${postId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content })
                });

                const data = await response.json();

                if (response.ok) {
                    commentInput.value = '';
                    // Refresh comments
                    toggleComments(postId);
                    toggleComments(postId); // Toggle twice to refresh
                    
                    // Update comment count
                    const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
                    const commentCount = commentBtn.querySelector('.comment-count');
                    commentCount.textContent = parseInt(commentCount.textContent) + 1;
                    
                } else {
                    alert('Error posting comment: ' + data.error);
                }
            } catch (error) {
                console.error('Error posting comment:', error);
                alert('Error posting comment');
            }
        }

        // Create new post
        createPostForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('post-title').value.trim();
            const content = document.getElementById('post-content').value.trim();

            if (!title || !content) {
                alert('Please fill in both title and content');
                return;
            }

            const submitBtn = createPostForm.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';

            try {
                const response = await fetch('/api/community/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        post_type: 'text'
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    // Clear form
                    document.getElementById('post-title').value = '';
                    document.getElementById('post-content').value = '';
                    
                    // Reload posts
                    loadPosts(1, false);
                    
                    alert('Post created successfully! ' + (data.moderation_status === 'FLAGGED' ? 'Your post is under review.' : ''));
                } else {
                    alert('Error creating post: ' + data.error);
                }
            } catch (error) {
                console.error('Error creating post:', error);
                alert('Error creating post');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Post';
            }
        });

        // Load more posts
        loadMoreBtn.addEventListener('click', () => {
            if (hasMore && !loading) {
                loadPosts(currentPage + 1, true);
            }
        });

        // Initial load
        loadPosts(1);
