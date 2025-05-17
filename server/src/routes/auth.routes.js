const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { protect } = require('../middleware/auth.middleware');

// Register user
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, role = 'member' } = req.body;

        // Check if user exists
        const userExists = await pool.request()
            .input('Email', email)
            .query('SELECT * FROM Users WHERE Email = @Email');

        if (userExists.recordset.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.request()
            .input('Email', email)
            .input('Password', hashedPassword)
            .input('FirstName', firstName)
            .input('LastName', lastName)
            .input('Role', role)
            .query(`
        INSERT INTO Users (Email, Password, FirstName, LastName, Role)
        OUTPUT INSERTED.UserID, INSERTED.Email, INSERTED.Role
        VALUES (@Email, @Password, @FirstName, @LastName, @Role)
      `);

        const user = result.recordset[0];

        // Generate token
        const token = jwt.sign(
            { id: user.UserID },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.UserID,
                email: user.Email,
                role: user.Role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error in registration'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const result = await pool.request()
            .input('Email', email)
            .query('SELECT * FROM Users WHERE Email = @Email');

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = result.recordset[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.UserID },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.UserID,
                email: user.Email,
                role: user.Role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error in login'
        });
    }
});

// Get current user
router.get('/me', protect, async (req, res) => {
    try {
        const result = await pool.request()
            .input('UserID', req.user.UserID)
            .query('SELECT UserID, Email, FirstName, LastName, Role FROM Users WHERE UserID = @UserID');

        res.json({
            success: true,
            user: result.recordset[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Error getting user profile'
        });
    }
});

module.exports = router; 