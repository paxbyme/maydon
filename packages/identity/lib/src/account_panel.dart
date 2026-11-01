import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maydon_api_client/api_client.dart';
import 'package:maydon_localization/localization.dart';
import '../identity.dart';

enum AccountStep {
  login,
  register,
  forgot,
  reset,
  email,
  phone,
  mfaSetup,
  mfaVerify,
}

class AccountPanel extends ConsumerStatefulWidget {
  const AccountPanel({super.key});
  @override
  ConsumerState<AccountPanel> createState() => _AccountPanelState();
}

class _AccountPanelState extends ConsumerState<AccountPanel> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _reference = TextEditingController();
  final _code = TextEditingController();
  AccountStep _step = AccountStep.login;
  bool _busy = false;
  bool _visiblePassword = false;
  String? _error;
  String? _notice;
  String? _enrollmentSecret;
  static final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
  static final _phonePattern = RegExp(r'^\+[1-9]\d{7,14}$');
  @override
  void dispose() {
    for (final c in [_email, _password, _name, _phone, _reference, _code]) {
      c.dispose();
    }
    super.dispose();
  }

  void _change(AccountStep step) {
    setState(() {
      _step = step;
      _error = null;
      _notice = null;
      _enrollmentSecret = null;
      _password.clear();
      _code.clear();
      _reference.clear();
    });
  }

  String _message(Object error, AppLocalizations s) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['code'] == 'INVALID_CHALLENGE') {
        return s.challengeError;
      }
      return switch (error.response?.statusCode) {
        401 => s.credentialsError,
        429 => s.rateError,
        403 || 409 => s.permissionError,
        400 => s.referenceInvalid,
        _ => s.connectionError,
      };
    }
    return s.storageError;
  }

  Future<void> _run(
    Future<void> Function() action, {
    bool validate = true,
  }) async {
    if (_busy || (validate && !(_form.currentState?.validate() ?? false))) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      await action();
    } catch (error) {
      if (mounted) _error = _message(error, AppLocalizations.of(context)!);
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _submit() => _run(() async {
    final session = ref.read(sessionProvider);
    final s = AppLocalizations.of(context)!;
    final api = session.api;
    switch (_step) {
      case AccountStep.login:
        await session.login(_email.text, _password.text);
        if (!mounted) return;
        _password.clear();
        await ref.read(localeProvider.notifier).select(session.user!.locale);
      case AccountStep.register:
        await api.authRegister(
          body: RegisterDto(
            email: _email.text.trim(),
            password: _password.text,
            displayName: _name.text.trim(),
            locale: Localizations.localeOf(context).languageCode,
          ),
        );
        if (!mounted) return;
        _password.clear();
        _step = AccountStep.email;
        _notice = s.checkMessages;
      case AccountStep.forgot:
        await api.authForgot(body: EmailDto(email: _email.text.trim()));
        if (!mounted) return;
        _step = AccountStep.reset;
        _notice = s.checkMessages;
      case AccountStep.reset:
        await api.authReset(
          body: ResetPasswordDto(
            challengeId: _reference.text.trim(),
            code: _code.text.trim(),
            password: _password.text,
          ),
        );
        if (!mounted) return;
        _password.clear();
        _code.clear();
        _reference.clear();
        _step = AccountStep.login;
        _notice = s.operationComplete;
      case AccountStep.email:
        await api.authVerifyEmail(
          body: ChallengeDto(
            challengeId: _reference.text.trim(),
            code: _code.text.trim(),
          ),
        );
        if (session.user != null) await session.loadProfile();
        if (!mounted) return;
        _step = AccountStep.login;
        _code.clear();
        _reference.clear();
        _notice = s.operationComplete;
      case AccountStep.phone:
        await session.authorized(
          (headers) => api.authVerifyPhone(
            body: ChallengeDto(
              challengeId: _reference.text.trim(),
              code: _code.text.trim(),
            ),
            headers: headers,
          ),
        );
        await session.loadProfile();
        if (!mounted) return;
        _step = AccountStep.login;
        _code.clear();
        _reference.clear();
        _notice = s.operationComplete;
      case AccountStep.mfaSetup:
        final setup = await session.authorized(
          (headers) => api.authSetup(
            body: MfaSetupDto(password: _password.text),
            headers: headers,
          ),
        );
        if (!mounted) return;
        _password.clear();
        _enrollmentSecret = setup.secret;
        _step = AccountStep.mfaVerify;
      case AccountStep.mfaVerify:
        await session.verifyMfa(
          _code.text.trim(),
          enrollment: _enrollmentSecret != null,
        );
        if (!mounted) return;
        _enrollmentSecret = null;
        _code.clear();
        _step = AccountStep.login;
        _notice = s.operationComplete;
    }
    if (mounted) FocusScope.of(context).unfocus();
  });
  Widget _field(
    TextEditingController c,
    String label, {
    TextInputType? keyboard,
    bool secret = false,
    String? hint,
    Iterable<String>? autofill,
    String? Function(String)? check,
    List<TextInputFormatter>? formatters,
  }) {
    final s = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        controller: c,
        enabled: !_busy,
        keyboardType: keyboard,
        obscureText: secret && !_visiblePassword,
        autocorrect: !secret && keyboard != TextInputType.emailAddress,
        enableSuggestions: !secret,
        autofillHints: autofill,
        inputFormatters: formatters,
        decoration: InputDecoration(
          labelText: label,
          helperText: hint,
          helperMaxLines: 3,
          errorMaxLines: 3,
          border: const OutlineInputBorder(),
          suffixIcon: secret
              ? IconButton(
                  tooltip: _visiblePassword ? s.hidePassword : s.showPassword,
                  onPressed: () =>
                      setState(() => _visiblePassword = !_visiblePassword),
                  icon: Icon(
                    _visiblePassword ? Icons.visibility_off : Icons.visibility,
                  ),
                )
              : null,
        ),
        validator: (value) => value == null || value.trim().isEmpty
            ? s.requiredField
            : check?.call(value),
        onFieldSubmitted: (_) {
          if (!_busy) _submit();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final s = AppLocalizations.of(context)!;
    final user = session.user;
    final locked = _busy || session.restoring;
    final account = user != null && _step == AccountStep.login;
    final title = account
        ? s.profile
        : switch (_step) {
            AccountStep.login => s.signIn,
            AccountStep.register => s.createAccount,
            AccountStep.forgot || AccountStep.reset => s.resetPassword,
            AccountStep.email => s.verifyEmail,
            AccountStep.phone => s.verifyPhone,
            AccountStep.mfaSetup || AccountStep.mfaVerify => s.mfaTitle,
          };
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: AutofillGroup(
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
                const SizedBox(height: 24),
                if (session.restoring) const LinearProgressIndicator(),
                if (session.restoreError != null) ...[
                  Text(
                    session.restoreError == 'CONNECTION'
                        ? s.connectionError
                        : s.storageError,
                  ),
                  TextButton(
                    onPressed: locked ? null : () => session.restore(),
                    child: Text(s.retry),
                  ),
                ],
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Semantics(
                      liveRegion: true,
                      child: Text(
                        _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  ),
                if (_notice != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Semantics(liveRegion: true, child: Text(_notice!)),
                  ),
                if (account) ...[
                  Text(
                    user.displayName,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(user.email),
                  const SizedBox(height: 24),
                  if (user.emailVerified)
                    Text(s.emailVerified)
                  else
                    OutlinedButton(
                      onPressed: locked
                          ? null
                          : () {
                              _email.text = user.email;
                              _change(AccountStep.email);
                            },
                      child: Text(s.verifyEmail),
                    ),
                  if (session.mfaRequired) ...[
                    const SizedBox(height: 16),
                    Text(s.mfaRequiredLabel),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: locked || !user.emailVerified
                          ? null
                          : () => _change(
                              user.mfaEnabled
                                  ? AccountStep.mfaVerify
                                  : AccountStep.mfaSetup,
                            ),
                      child: Text(user.mfaEnabled ? s.confirm : s.mfaSetup),
                    ),
                  ] else ...[
                    const SizedBox(height: 16),
                    if (user.phoneVerified)
                      Text('${s.phoneVerified}: ${user.phone}')
                    else
                      OutlinedButton(
                        onPressed: locked || !user.emailVerified
                            ? null
                            : () => _change(AccountStep.phone),
                        child: Text(s.verifyPhone),
                      ),
                    if (!user.mfaEnabled)
                      OutlinedButton(
                        onPressed: locked || !user.emailVerified
                            ? null
                            : () => _change(AccountStep.mfaSetup),
                        child: Text(s.mfaSetup),
                      ),
                    TextButton(
                      onPressed: locked
                          ? null
                          : () => _run(
                              () => session.logout(all: true),
                              validate: false,
                            ),
                      child: Text(s.revokeSessions),
                    ),
                  ],
                  TextButton(
                    onPressed: locked
                        ? null
                        : () => _run(() => session.logout(), validate: false),
                    child: Text(s.signOut),
                  ),
                ] else ...[
                  if ([
                    AccountStep.login,
                    AccountStep.register,
                    AccountStep.forgot,
                    AccountStep.email,
                  ].contains(_step))
                    _field(
                      _email,
                      s.emailLabel,
                      keyboard: TextInputType.emailAddress,
                      autofill: const [AutofillHints.email],
                      check: (value) => _emailPattern.hasMatch(value.trim())
                          ? null
                          : s.emailInvalid,
                    ),
                  if (_step == AccountStep.register)
                    _field(
                      _name,
                      s.nameLabel,
                      autofill: const [AutofillHints.name],
                      formatters: [LengthLimitingTextInputFormatter(100)],
                    ),
                  if ([
                    AccountStep.login,
                    AccountStep.register,
                    AccountStep.reset,
                    AccountStep.mfaSetup,
                  ].contains(_step))
                    _field(
                      _password,
                      s.passwordLabel,
                      secret: true,
                      autofill: [
                        _step == AccountStep.register ||
                                _step == AccountStep.reset
                            ? AutofillHints.newPassword
                            : AutofillHints.password,
                      ],
                      hint:
                          _step == AccountStep.register ||
                              _step == AccountStep.reset
                          ? s.passwordHint
                          : null,
                      check: (value) =>
                          value.length > 128 ||
                              ((_step == AccountStep.register ||
                                      _step == AccountStep.reset) &&
                                  value.length < 12)
                          ? s.passwordHint
                          : null,
                    ),
                  if (_step == AccountStep.phone) ...[
                    _field(
                      _phone,
                      s.phoneLabel,
                      keyboard: TextInputType.phone,
                      autofill: const [AutofillHints.telephoneNumber],
                      check: (value) => _phonePattern.hasMatch(value.trim())
                          ? null
                          : s.phoneInvalid,
                    ),
                    OutlinedButton(
                      onPressed: locked
                          ? null
                          : () => _run(() async {
                              if (!_phonePattern.hasMatch(_phone.text.trim())) {
                                _error = s.phoneInvalid;
                                return;
                              }
                              await session.authorized(
                                (headers) => session.api.authPhone(
                                  body: PhoneDto(phone: _phone.text.trim()),
                                  headers: headers,
                                ),
                              );
                              _notice = s.checkMessages;
                            }, validate: false),
                      child: Text(s.sendCode),
                    ),
                  ],
                  if (_step == AccountStep.email)
                    OutlinedButton(
                      onPressed: locked
                          ? null
                          : () => _run(() async {
                              if (!_emailPattern.hasMatch(_email.text.trim())) {
                                _error = s.emailInvalid;
                                return;
                              }
                              await session.api.authResend(
                                body: EmailDto(email: _email.text.trim()),
                              );
                              _notice = s.checkMessages;
                            }, validate: false),
                      child: Text(s.sendCode),
                    ),
                  if ([
                    AccountStep.email,
                    AccountStep.phone,
                    AccountStep.reset,
                  ].contains(_step))
                    _field(
                      _reference,
                      s.verificationReference,
                      check: (value) =>
                          RegExp(
                            r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
                          ).hasMatch(value.trim())
                          ? null
                          : s.referenceInvalid,
                    ),
                  if (_enrollmentSecret != null) ...[
                    Text(s.mfaSecretHelp),
                    const SizedBox(height: 12),
                    SelectableText(_enrollmentSecret!),
                    const SizedBox(height: 20),
                  ],
                  if ([
                    AccountStep.email,
                    AccountStep.phone,
                    AccountStep.reset,
                    AccountStep.mfaVerify,
                  ].contains(_step))
                    _field(
                      _code,
                      s.codeLabel,
                      keyboard: TextInputType.number,
                      autofill: const [AutofillHints.oneTimeCode],
                      formatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      check: (value) => RegExp(r'^\d{6}$').hasMatch(value)
                          ? null
                          : s.codeInvalid,
                    ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: locked ? null : _submit,
                    child: Text(
                      _busy
                          ? s.saving
                          : switch (_step) {
                              AccountStep.login => s.signIn,
                              AccountStep.register => s.createAccount,
                              AccountStep.forgot => s.sendCode,
                              _ => s.confirm,
                            },
                    ),
                  ),
                  if (_step == AccountStep.login) ...[
                    TextButton(
                      onPressed: locked
                          ? null
                          : () => _change(AccountStep.register),
                      child: Text(s.createAccount),
                    ),
                    TextButton(
                      onPressed: locked
                          ? null
                          : () => _change(AccountStep.forgot),
                      child: Text(s.forgotPassword),
                    ),
                    TextButton(
                      onPressed: locked
                          ? null
                          : () => _change(AccountStep.email),
                      child: Text(s.verifyEmail),
                    ),
                  ] else
                    TextButton(
                      onPressed: locked
                          ? null
                          : () => _change(AccountStep.login),
                      child: Text(s.backToAccount),
                    ),
                  if (const bool.fromEnvironment(
                        'MAYDON_LOCAL_DELIVERY',
                        defaultValue: true,
                      ) &&
                      _step != AccountStep.login)
                    Padding(
                      padding: const EdgeInsets.only(top: 16),
                      child: Text(
                        s.localDeliveryNotice,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
