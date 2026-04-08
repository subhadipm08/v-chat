export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    
    // Assign validated data back to request
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;
    
    next();
  } catch (error) {
    if (error.errors) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors.map(err => ({ field: err.path.join('.'), message: err.message })) 
      });
    }
    next(error);
  }
};
