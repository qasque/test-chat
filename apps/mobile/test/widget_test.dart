import 'package:flutter_test/flutter_test.dart';
import 'package:support_operator/app.dart';

void main() {
  testWidgets('app starts', (WidgetTester tester) async {
    await tester.pumpWidget(const SupportOperatorApp());
    await tester.pump();
    expect(find.byType(SupportOperatorApp), findsOneWidget);
  });
}
